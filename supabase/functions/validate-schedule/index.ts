import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type S = { starts_at:string; ends_at:string }
type E = { id:string; employee_id:string; work_date:string; day_type:string; shift_segments:S[]; employees:{full_name:string}|null }
type R = { code:string; severity:'info'|'warning'|'critical'; blocking:boolean; parameters:Record<string,unknown> }
type C = { employee_id:string; start_at:string; end_at:string|null; type:string }
const ms=(x:string)=>new Date(x).getTime(), order=(s:S[])=>[...s].sort((a,b)=>ms(a.starts_at)-ms(b.starts_at))
const day=(d:string,n:number)=>{const x=new Date(`${d}T12:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
const sunday=(d:string)=>new Date(`${d}T12:00:00Z`).getUTCDay()===0
const work=(e:E|undefined)=>Boolean(e&&e.day_type==='work'&&e.shift_segments?.length)
const workedMinutes=(e:E)=>order(e.shift_segments??[]).reduce((total,s)=>total+(ms(s.ends_at)-ms(s.starts_at))/60000,0)

Deno.serve(async request => {
  const authorization=request.headers.get('Authorization'); if(!authorization)return Response.json({error:'Unauthorized'},{status:401})
  const caller=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}})
  const {data:{user}}=await caller.auth.getUser(); if(!user)return Response.json({error:'Unauthorized'},{status:401})
  const {scheduleId,expectedRevision}=await request.json() as {scheduleId:string;expectedRevision:number}
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data:schedule,error:scheduleError}=await admin.from('schedules').select('id,store_id,week_start,revision,rule_set_id').eq('id',scheduleId).single()
  if(scheduleError||!schedule)return Response.json({error:'Schedule not found'},{status:404})
  const {data:member}=await admin.from('store_memberships').select('role').eq('store_id',schedule.store_id).eq('user_id',user.id).in('role',['owner','manager','supervisor']).maybeSingle()
  if(!member)return Response.json({error:'Forbidden'},{status:403}); if(schedule.revision!==expectedRevision)return Response.json({error:'REVISION_CONFLICT',currentRevision:schedule.revision},{status:409})
  const select='id,employee_id,work_date,day_type,shift_segments(starts_at,ends_at),employees(full_name)'
  const {data:now,error:nowError}=await admin.from('schedule_entries').select(select).eq('schedule_id',scheduleId); if(nowError)return Response.json({error:nowError.message},{status:400})
  const current=(now??[]) as E[], employeeIds=[...new Set(current.map(e=>e.employee_id))], start=day(schedule.week_start,-21), end=day(schedule.week_start,13)
  const {data:past,error:pastError}=employeeIds.length?await admin.from('schedule_entries').select(select).in('employee_id',employeeIds).gte('work_date',start).lte('work_date',end):{data:[],error:null}
  if(pastError)return Response.json({error:pastError.message},{status:400})
  const entries=(past??[]) as E[]
  const weekEnd=day(schedule.week_start,7)
  const {data:contractRows}=employeeIds.length?await admin.from('employment_contracts').select('employee_id,weekly_minutes').in('employee_id',employeeIds).lte('start_date',schedule.week_start).or(`end_date.is.null,end_date.gte.${schedule.week_start}`):{data:[]}
  const weeklyMinutesByEmployee=new Map((contractRows??[]).map(c=>[c.employee_id,Number(c.weekly_minutes)]))
  const {data:constraintRows}=employeeIds.length?await admin.from('employee_constraints').select('employee_id,start_at,end_at,type').in('employee_id',employeeIds).lt('start_at',`${weekEnd}T00:00:00Z`).or(`end_at.is.null,end_at.gte.${schedule.week_start}T00:00:00Z`):{data:[]}
  const constraints=(constraintRows??[]) as C[]
  const {data:rawRules}=schedule.rule_set_id?await admin.from('rules').select('code,severity,blocking,parameters').eq('rule_set_id',schedule.rule_set_id):{data:[]}
  const map=new Map((rawRules??[]).map(x=>[x.code,x as R])), rule=(code:string,fallback:R)=>map.get(code)??fallback
  const inter=rule('INTERJOURNEY_MIN',{code:'INTERJOURNEY_MIN',severity:'critical',blocking:true,parameters:{minimum_minutes:660}})
  const overlap=rule('SEGMENT_OVERLAP',{code:'SEGMENT_OVERLAP',severity:'critical',blocking:true,parameters:{}})
  const streakRule=rule('WEEKLY_REST_WINDOW',{code:'WEEKLY_REST_WINDOW',severity:'critical',blocking:true,parameters:{maximum_consecutive_days:7}})
  const around=rule('SUNDAY_REST_AROUND',{code:'SUNDAY_REST_AROUND',severity:'critical',blocking:true,parameters:{pre_days:6,post_days:6}})
  const rotation=rule('SUNDAY_REST_ROTATION',{code:'SUNDAY_REST_ROTATION',severity:'critical',blocking:true,parameters:{window_weeks:3,maximum_worked_sundays:2}})
  const intraday=map.get('INTRADAY_BREAK')
  const dailyMax=map.get('DAILY_MINUTES')
  const weeklyMax=map.get('WEEKLY_MINUTES')
  const unavailable=map.get('EMPLOYEE_UNAVAILABLE')
  const violations:Array<Record<string,unknown>>=[], currentIds=new Set(current.map(e=>e.id)), byEmployee=new Map<string,E[]>()
  for(const e of entries)byEmployee.set(e.employee_id,[...(byEmployee.get(e.employee_id)??[]),e])
  for(const [employeeId,all] of byEmployee){
    const dates=new Map<string,E>(); for(const e of all){const old=dates.get(e.work_date);if(!old||currentIds.has(e.id))dates.set(e.work_date,e)}
    let consecutive=0; for(let d=start;d<=end;d=day(d,1)){const e=dates.get(d);consecutive=work(e)?consecutive+1:0;if(e&&currentIds.has(e.id)&&consecutive>Number(streakRule.parameters.maximum_consecutive_days??7))violations.push({employee_id:employeeId,entry_id:e.id,rule_code:streakRule.code,severity:streakRule.severity,blocking:streakRule.blocking,evidence:{consecutive_days:consecutive},message:`Sequência de ${consecutive} dias sem folga.`})}
    let previous:E|undefined; for(const e of [...dates.values()].sort((a,b)=>a.work_date.localeCompare(b.work_date))){const segments=order(e.shift_segments??[]);if(!work(e)){previous=undefined;continue}if(currentIds.has(e.id)&&segments.some((s,i)=>i>0&&ms(s.starts_at)<ms(segments[i-1].ends_at)))violations.push({employee_id:employeeId,entry_id:e.id,rule_code:overlap.code,severity:overlap.severity,blocking:overlap.blocking,evidence:{segments},message:`Há períodos sobrepostos para ${e.employees?.full_name??'colaborador'}.`});if(previous&&currentIds.has(e.id)){const p=order(previous.shift_segments??[]).at(-1)!,actual=Math.round((ms(segments[0].starts_at)-ms(p.ends_at))/60000),minimum=Number(inter.parameters.minimum_minutes??660);if(actual<minimum)violations.push({employee_id:employeeId,entry_id:e.id,rule_code:inter.code,severity:inter.severity,blocking:inter.blocking,evidence:{actual_minutes:actual,minimum_minutes:minimum},message:`Interjornada de ${actual} minutos; mínimo configurado de ${minimum}.`})}previous=e}
    for(const e of current.filter(x=>x.employee_id===employeeId&&sunday(x.work_date)&&work(x))){const before=Array.from({length:Number(around.parameters.pre_days??6)},(_,i)=>dates.get(day(e.work_date,-i-1))),after=Array.from({length:Number(around.parameters.post_days??6)},(_,i)=>dates.get(day(e.work_date,i+1)));if(!before.some(x=>x&&!work(x))||!after.some(x=>x&&!work(x)))violations.push({employee_id:employeeId,entry_id:e.id,rule_code:around.code,severity:around.severity,blocking:around.blocking,evidence:{sunday:e.work_date,pre_rest:before.some(x=>x&&!work(x)),post_rest:after.some(x=>x&&!work(x))},message:'Domingo exige folga programada antes e depois, conforme regra operacional ativa.'});const weeks=Number(rotation.parameters.window_weeks??3),worked=Array.from({length:weeks},(_,i)=>dates.get(day(e.work_date,-7*i))).filter(x=>x&&work(x)).length;if(worked>Number(rotation.parameters.maximum_worked_sundays??2))violations.push({employee_id:employeeId,entry_id:e.id,rule_code:rotation.code,severity:rotation.severity,blocking:rotation.blocking,evidence:{worked_sundays:worked,window_weeks:weeks},message:`Rodízio de domingos excede a janela configurada de ${weeks} semanas.`})}
    // Intrajornada: pausa mínima cresce com a duração da jornada (CLT art. 71), configurável por perfil.
    if(intraday)for(const e of current.filter(x=>x.employee_id===employeeId&&work(x))){const segments=order(e.shift_segments??[]);if(segments.length<2)continue;const dailyTotal=workedMinutes(e),breakMinutes=Math.round((ms(segments[1].starts_at)-ms(segments[0].ends_at))/60000),thresholdOver=Number(intraday.parameters.threshold_over_hours??6)*60,thresholdPartial=Number(intraday.parameters.threshold_partial_hours??4)*60,requiredOver=Number(intraday.parameters.minimum_break_over_minutes??60),requiredPartial=Number(intraday.parameters.minimum_break_partial_minutes??15),required=dailyTotal>thresholdOver?requiredOver:dailyTotal>thresholdPartial?requiredPartial:0;if(required>0&&breakMinutes<required)violations.push({employee_id:employeeId,entry_id:e.id,rule_code:intraday.code,severity:intraday.severity,blocking:intraday.blocking,evidence:{break_minutes:breakMinutes,required_minutes:required,daily_minutes:dailyTotal},message:`Intervalo de ${breakMinutes} minutos abaixo do mínimo de ${required} para uma jornada de ${Math.round(dailyTotal/60)}h.`})}
    // Carga diária: soma dos segmentos do dia acima do teto configurado.
    if(dailyMax)for(const e of current.filter(x=>x.employee_id===employeeId&&work(x))){const total=Math.round(workedMinutes(e)),maximum=Number(dailyMax.parameters.maximum_minutes??600);if(total>maximum)violations.push({employee_id:employeeId,entry_id:e.id,rule_code:dailyMax.code,severity:dailyMax.severity,blocking:dailyMax.blocking,evidence:{worked_minutes:total,maximum_minutes:maximum},message:`Carga diária de ${total} minutos acima do máximo configurado de ${maximum}.`})}
    // Carga semanal: soma da semana exibida comparada ao contrato vigente (mais tolerância configurável).
    if(weeklyMax){const weekEntries=current.filter(x=>x.employee_id===employeeId&&x.work_date>=schedule.week_start&&x.work_date<weekEnd&&work(x));if(weekEntries.length){const total=Math.round(weekEntries.reduce((sum,e)=>sum+workedMinutes(e),0)),contracted=weeklyMinutesByEmployee.get(employeeId)??Number(weeklyMax.parameters.default_weekly_minutes??2640),tolerance=Number(weeklyMax.parameters.tolerance_minutes??0),maximum=contracted+tolerance;if(total>maximum)violations.push({employee_id:employeeId,entry_id:weekEntries[weekEntries.length-1].id,rule_code:weeklyMax.code,severity:weeklyMax.severity,blocking:weeklyMax.blocking,evidence:{worked_minutes:total,contracted_minutes:contracted,tolerance_minutes:tolerance},message:`Carga semanal de ${total} minutos acima do contrato (${contracted} + ${tolerance} de tolerância).`})}}
    // Indisponibilidade: turno agendado sobre uma restrição ativa do colaborador.
    if(unavailable){const own=constraints.filter(c=>c.employee_id===employeeId);if(own.length)for(const e of current.filter(x=>x.employee_id===employeeId&&work(x))){const segments=order(e.shift_segments??[]);for(const c of own){const constraintEnd=c.end_at?ms(c.end_at):Infinity;if(segments.some(s=>ms(s.starts_at)<constraintEnd&&ms(s.ends_at)>ms(c.start_at))){violations.push({employee_id:employeeId,entry_id:e.id,rule_code:unavailable.code,severity:unavailable.severity,blocking:unavailable.blocking,evidence:{constraint_type:c.type,constraint_start:c.start_at,constraint_end:c.end_at},message:`Turno agendado durante uma restrição de disponibilidade (${c.type}).`});break}}}}
  }
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({current,entries,rules:rawRules??[]}))),checksum=Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join(''),blocking=violations.filter(v=>v.blocking).length
  const {data:run,error:runError}=await admin.from('validation_runs').insert({schedule_id:scheduleId,schedule_revision:schedule.revision,rule_set_id:schedule.rule_set_id,status:blocking?'failed':'passed',checksum,started_at:new Date().toISOString(),completed_at:new Date().toISOString()}).select('id').single();if(runError||!run)return Response.json({error:runError?.message??'Could not record validation'},{status:400})
  if(violations.length)await admin.from('violations').insert(violations.map(v=>({...v,validation_run_id:run.id})))
  await admin.from('schedules').update({status:blocking?'has_conflicts':'ready'}).eq('id',scheduleId).eq('revision',schedule.revision)
  return Response.json({validationRunId:run.id,checksum,violations,blocking})
})

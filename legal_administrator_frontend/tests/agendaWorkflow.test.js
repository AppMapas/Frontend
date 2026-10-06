import { test,beforeEach,afterEach,describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia,setActivePinia } from 'pinia'
import { dayKey,dayStart,monthWindow,monthDays,eventPayload,eventErrors,emptyEvent } from '../src/modules/agenda/domain/agenda.js'
import { agendaApi } from '../src/modules/agenda/services/agendaApi.js'
import { useAgendaStore } from '../src/modules/agenda/stores/agendaStore.js'
import { useAgendaSubmissionStore } from '../src/modules/agenda/stores/agendaSubmissionStore.js'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
describe('Agenda interna y sincronización',()=>{
const original=globalThis.fetch
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{setActivePinia(createPinia());configureHttpClientAuth({getAccessToken:()=> 'jwt',canRefresh:()=>false,logout:null})})
afterEach(()=>{globalThis.fetch=original;delete globalThis.window;configureHttpClientAuth({getAccessToken:()=>null})})
test('fechas usan Guatemala independientemente del teléfono y el fin mensual es exclusivo',()=>{
 assert.equal(dayKey('2026-10-06T02:00:00Z'),'2026-10-05')
 assert.equal(dayStart('2026-10-06'),'2026-10-06T06:00:00.000Z')
 assert.deepEqual(monthWindow('2026-12-20'),{from:'2026-12-01T06:00:00.000Z',to:'2027-01-01T06:00:00.000Z'})
 assert.equal(monthDays('2026-10-06').length,42)
})
test('citas requieren cliente y audiencias o cobros requieren expediente',()=>{
 const form=emptyEvent('2027-01-01');form.title='Consulta'
 assert.ok(eventErrors(form).client)
 form.client={dpi:'1000000000001'};assert.deepEqual(eventErrors(form),{})
 form.type='HEARING';assert.ok(eventErrors(form).caseId)
 form.caseId=4;assert.deepEqual(eventErrors(form),{})
 const payload=eventPayload(form,'key');assert.equal(payload.clientDpi,null);assert.equal(payload.caseId,4)
 assert.equal(payload.startsAt,'2027-01-01T15:00:00.000Z');assert.equal(payload.timeZone,'America/Guatemala')
})
test('todo el día exige fin exclusivo a medianoche y no acepta intervalos invertidos',()=>{
 const form={...emptyEvent('2027-01-01'),title:'Consulta',client:{dpi:'1000000000001'},allDay:true}
 assert.ok(eventErrors(form).endsAt);form.startsAt='2027-01-01T00:00';form.endsAt='2027-01-02T00:00'
 assert.deepEqual(eventErrors(form),{});form.endsAt=form.startsAt;assert.ok(eventErrors(form).endsAt)
})
test('OAuth envía la sesión propia y la cabecera de protección sin exponer tokens de Google',async()=>{
 globalThis.fetch=async(url,options)=>{assert.match(url,/agenda\/google\/connect$/);assert.equal(options.headers.get('Authorization'),'Bearer jwt');assert.equal(options.headers.get('X-Requested-With'),'XmlHttpRequest');assert.deepEqual(JSON.parse(options.body),{code:'single-use',state:'intent'});return json({state:'CONNECTED'})}
 assert.equal((await agendaApi.connect({code:'single-use',state:'intent'})).state,'CONNECTED')
})
test('respuesta perdida conserva el identificador de creación y recupera el intento al recargar',async()=>{
 const storage=new Map();globalThis.window={sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));if(calls.length===1)throw new TypeError('offline');return json({id:1,version:0})}
 const payload={requestId:'key',startsAt:'2027-01-01T15:00:00Z'},submission=useAgendaSubmissionStore()
 await assert.rejects(submission.send(payload,'actor'))
 setActivePinia(createPinia());const recovered=useAgendaSubmissionStore();recovered.restore('actor')
 await recovered.send({...payload,requestId:'different'},'actor');assert.deepEqual(calls[0],calls[1]);assert.equal(recovered.pending,null)
})
test('doble clic y logout no duplican ni recuperan datos de otra sesión',async()=>{
 let release,calls=0;globalThis.fetch=async()=>{calls++;await new Promise(resolve=>{release=resolve});return json({id:1,version:0})}
 const submission=useAgendaSubmissionStore();const a=submission.send({requestId:'key'},'actor');const b=submission.send({requestId:'key'},'actor')
 submission.reset();release();assert.equal(await a,null);assert.equal(await b,null);assert.equal(calls,1)
})
test('listado tardío no vuelve a poblar la agenda después de cerrar sesión',async()=>{
 let release;globalThis.fetch=async()=>{await new Promise(resolve=>{release=resolve});return json({content:[{id:1}],totalPages:1,totalElements:1})}
 const agenda=useAgendaStore();const pending=agenda.load({page:0,size:25});agenda.reset();release();assert.equal(await pending,null);assert.deepEqual(agenda.events,[])
})

})

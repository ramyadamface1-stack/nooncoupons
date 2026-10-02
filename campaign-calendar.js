const DAY_MS=86400000;
const TIMEZONE='Africa/Cairo';
const SOURCE='user-supplied-noon-core-october-2026-calendar';
const ALL_PROFILES=['mobile','computing','audio','screen','fashion','beauty','appliance','kitchen','home','grocery','kids','baby','fitness','travel','auto','office','pets'];

export const NOON_CORE_CAMPAIGNS=Object.freeze([
  {id:'grocery-saver-week-noon',name:'Grocery Saver Week',searchTerm:'Grocery Saver Week',countries:['SA','AE'],start:'2026-10-01',end:'2026-10-07',leadDays:2,priority:4,profiles:['grocery','baby','beauty','home'],kind:'campaign'},
  {id:'grand-lifestyle-reset',name:'Grand Lifestyle Reset',searchTerm:'Lifestyle Reset',countries:['SA','AE'],start:'2026-10-05',end:'2026-10-08',leadDays:5,priority:5,profiles:['home','fashion','beauty','fitness','mobile','computing','screen'],kind:'campaign'},
  {id:'ten-ten-sale',name:'10.10 Sale',searchTerm:'10.10 Sale',countries:['SA'],start:'2026-10-08',end:'2026-10-11',leadDays:6,priority:6,profiles:ALL_PROFILES,kind:'campaign'},
  {id:'back-to-outdoors',name:'Back to Outdoors',countries:['SA','AE'],start:'2026-10-08',end:'2026-10-20',leadDays:4,priority:3,profiles:['fitness','travel','fashion','home','kids'],kind:'intervention'},
  {id:'mega-tech-festival',name:'Mega Tech Festival',searchTerm:'Tech Festival',countries:['SA','AE'],start:'2026-10-16',end:'2026-10-19',leadDays:6,priority:5,profiles:['screen','appliance','computing','mobile','audio'],kind:'campaign'},
  {id:'dubai-home-festival',name:'Dubai Home Festival',searchTerm:'Dubai Home Festival',countries:['AE'],start:'2026-10-16',end:'2026-11-01',leadDays:6,priority:4,profiles:['home','kitchen','appliance'],kind:'campaign'},
  {id:'diwali',name:'Diwali',countries:['AE'],start:'2026-10-18',end:null,planningEnd:'2026-11-02',leadDays:4,priority:2,profiles:['home','kitchen','fashion','beauty'],kind:'intervention'},
  {id:'beauty-fest-uae',name:'Beauty Fest UAE',countries:['AE'],start:'2026-10-20',end:'2026-10-31',leadDays:5,priority:4,profiles:['beauty'],kind:'intervention'},
  {id:'dubai-30x30',name:'Dubai 30x30',countries:['AE'],start:'2026-10-20',end:null,planningEnd:'2026-11-02',leadDays:4,priority:3,profiles:['fitness','fashion','mobile'],kind:'intervention'},
  {id:'end-of-month-sale',name:'End of Month Sale',searchTerm:'End of Month Sale',countries:['SA','AE'],start:'2026-10-24',end:'2026-11-02',leadDays:6,priority:5,profiles:ALL_PROFILES,kind:'campaign'},
  {id:'beauty-fest-ksa',name:'Beauty Fest KSA',countries:['SA'],start:'2026-10-24',end:'2026-10-31',leadDays:5,priority:4,profiles:['beauty'],kind:'intervention'},
  {id:'teachers-day',name:"Teacher's Day",countries:['SA','AE'],start:null,planningStart:'2026-10-01',end:'2026-10-05',leadDays:0,priority:1,profiles:['home','office','kids'],kind:'intervention'},
  {id:'halloween',name:'Halloween',countries:['SA','AE'],start:'2026-10-01',end:'2026-10-31',leadDays:0,priority:2,profiles:['kids','fashion','home','grocery'],kind:'intervention'}
]);

const parseDay=day=>Date.parse(String(day)+'T00:00:00Z');
function cairoDay(input=new Date()){
  if(typeof input==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input))return input;
  const d=input instanceof Date?input:new Date(input);
  if(Number.isNaN(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function phaseFor(e,dayKey){
  const start=e.start||e.planningStart,end=e.end||e.planningEnd;
  if(!start||!end||!dayKey)return null;
  const day=parseDay(dayKey),startMs=parseDay(start),endMs=parseDay(end),preheat=startMs-Math.max(0,Number(e.leadDays||0))*DAY_MS;
  if(day<preheat||day>endMs)return null;
  return day<startMs?'preheat':'active';
}
export function getCampaignWindow(date=new Date(),market=null){
  const dayKey=cairoDay(date),m=String(market||'').toUpperCase();
  return NOON_CORE_CAMPAIGNS
    .filter(e=>(!m||e.countries.includes(m))&&phaseFor(e,dayKey))
    .map(e=>({...e,phase:phaseFor(e,dayKey),dayKey,tentative:true,source:SOURCE,startKnown:Boolean(e.start),endKnown:Boolean(e.end)}))
    .sort((a,b)=>(a.phase===b.phase?0:a.phase==='active'?-1:1)||(b.priority-a.priority)||a.id.localeCompare(b.id));
}
function weighted(events){
  const out=[];
  for(const e of events||[])for(let i=0;i<Math.max(1,Number(e.priority||1));i++)out.push(e);
  return out;
}
function pickMarket(e,seed,forced){
  const f=String(forced||'').toUpperCase();
  if(f==='SA'||f==='AE')return e.countries.includes(f)?f:null;
  if(e.countries.length===1)return e.countries[0];
  return seed%5<3?'SA':'AE';
}
export function campaignGenerationPlan(cursor=0,windowOrDate=new Date(),market=null){
  const seed=Math.abs(Number(cursor)||0),events=Array.isArray(windowOrDate)?windowOrDate:getCampaignWindow(windowOrDate,market),m=String(market||'').toUpperCase(),eligible=m?events.filter(e=>e.countries.includes(m)):events;
  if(!eligible.length||seed%4===3)return {active:false,forceCountry:'',forceProfiles:[],calendarVersion:CAMPAIGN_CALENDAR_INFO.version};
  const pool=weighted(eligible),event=pool[seed%pool.length],forceCountry=pickMarket(event,seed,m);
  if(!forceCountry)return {active:false,forceCountry:'',forceProfiles:[],calendarVersion:CAMPAIGN_CALENDAR_INFO.version};
  const searchEligible=event.kind==='campaign'&&Boolean(event.startKnown)&&Boolean(event.endKnown)&&Boolean(event.searchTerm);
  return {active:true,id:event.id,name:event.name,phase:event.phase,kind:event.kind,forceCountry,forceProfiles:[...event.profiles],tentative:true,source:SOURCE,dayKey:event.dayKey,start:event.start||null,end:event.end||null,startKnown:event.startKnown,endKnown:event.endKnown,searchEligible,seasonalTerm:searchEligible?event.searchTerm:'',calendarVersion:CAMPAIGN_CALENDAR_INFO.version};
}
export function applyCampaignPlan(topic,plan){
  if(!plan?.active)return topic;
  return {...topic,seasonalTerm:plan.searchEligible?(plan.seasonalTerm||topic?.seasonalTerm||''):(topic?.seasonalTerm||''),campaignId:plan.id,campaignName:plan.name,campaignPhase:plan.phase,campaignKind:plan.kind,campaignSearchEligible:Boolean(plan.searchEligible),campaignTentative:true,campaignCalendarSource:plan.source,campaignCalendarVersion:plan.calendarVersion,campaignStart:plan.start,campaignEnd:plan.end,campaignStartKnown:Boolean(plan.startKnown),campaignEndKnown:Boolean(plan.endKnown)};
}
export const CAMPAIGN_CALENDAR_INFO={
  version:'noon-core-oct-2026-v1',timezone:TIMEZONE,source:SOURCE,tentative:true,brandScope:'Noon Core only',excludedBrandCalendars:['Namshi'],markets:['SA','AE'],campaignSlotShare:75,dualMarketSplit:{SA:60,AE:40},publicKeywordInjection:'exact-dated-campaigns-only',eventCount:NOON_CORE_CAMPAIGNS.length
};

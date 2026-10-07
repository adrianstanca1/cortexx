import React,{useEffect,useMemo,useState}from'react';
import{View,Text,FlatList,TouchableOpacity,StyleSheet,RefreshControl,ActivityIndicator,Modal,TextInput,Alert,ScrollView}from'react-native';
import{Colors}from'./theme';
import{getCollection,getProjects,postCollection,putCollection,type AuthUser}from'./api';

type Rfi={id:string;number:string;subject:string;body:string;projectId:string;status:string;priority:string;assignee?:string|null;dueDate?:string|null;response?:string|null;project?:{id:string;name:string}|null};
const priorities=['low','medium','high'] as const;

export default function RfisScreen({user,onLogout}:{user:AuthUser;onLogout:()=>void}){
  const[items,setItems]=useState<Rfi[]>([]),[projects,setProjects]=useState<any[]>([]),[loading,setLoading]=useState(true),[err,setErr]=useState('');
  const[modal,setModal]=useState(false),[saving,setSaving]=useState(false),[active,setActive]=useState<Rfi|null>(null);
  const[form,setForm]=useState({projectId:'',subject:'',body:'',priority:'medium',assignee:'',dueDate:''});
  const[response,setResponse]=useState('');
  const canManage=['company_admin','project_manager','foreman'].includes(String(user.role||'').toLowerCase());
  const load=async()=>{setLoading(true);setErr('');try{const[r,p]=await Promise.all([getCollection('rfis',200),getProjects()]);setItems((r||[])as Rfi[]);setProjects(p||[]);if(!form.projectId&&p?.[0]?.id)setForm(f=>({...f,projectId:p[0].id}));}catch(e:any){setErr(e?.message||'Failed to load RFIs');if(e?.message==='unauthorized')onLogout();}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
  const open=()=>{setForm({projectId:projects[0]?.id||'',subject:'',body:'',priority:'medium',assignee:'',dueDate:''});setModal(true)};
  const save=async()=>{if(!form.projectId||!form.subject.trim()||!form.body.trim()){Alert.alert('Missing information','Project, subject and question are required.');return}setSaving(true);try{const r=await postCollection('rfis',{...form,subject:form.subject.trim(),body:form.body.trim(),assignee:form.assignee.trim()||null,dueDate:form.dueDate||null});setModal(false);if(r?._queued)Alert.alert('Queued offline','RFI will sync when connection returns.');await load()}catch(e:any){Alert.alert('Save failed',e?.message||'Please retry.')}finally{setSaving(false)}};
  const update=async(item:Rfi,body:any)=>{setSaving(true);try{const r=await putCollection('rfis',item.id,body);if(r?._queued)Alert.alert('Queued offline','Update will sync when connection returns.');setActive(null);setResponse('');await load()}catch(e:any){Alert.alert('Update failed',e?.message||'Please retry.')}finally{setSaving(false)}};
  const overdue=(item:Rfi)=>item.status!=='closed'&&!!item.dueDate&&new Date(item.dueDate).getTime()<Date.now();
  const stats=useMemo(()=>({open:items.filter(i=>i.status!=='closed').length,overdue:items.filter(overdue).length}),[items]);

  if(loading)return<View style={s.center}><ActivityIndicator color={Colors.amber}/></View>;
  return<View style={s.wrap}>
    <View style={s.header}><View><Text style={s.kicker}>TECHNICAL CONTROL</Text><Text style={s.h1}>RFIs</Text><Text style={s.sub}>{stats.open} open · {stats.overdue} overdue</Text></View>{canManage?<TouchableOpacity onPress={open}><Text style={s.add}>+ New</Text></TouchableOpacity>:null}</View>
    {err?<Text style={s.err}>{err}</Text>:null}
    <FlatList data={items} keyExtractor={i=>i.id} refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={load}/>} contentContainerStyle={s.list}
      renderItem={({item})=><TouchableOpacity style={s.card} onPress={()=>{setActive(item);setResponse(item.response||'')}}>
        <View style={s.between}><Text style={s.num}>{item.number}</Text><Text style={[s.status,{color:item.status==='closed'?Colors.green:item.status==='answered'?Colors.blue:overdue(item)?Colors.red:Colors.amber}]}>{item.status.toUpperCase()}</Text></View>
        <Text style={s.title}>{item.subject}</Text>
        <Text style={s.meta}>{item.project?.name||projects.find(p=>p.id===item.projectId)?.name||'Project'} · {item.priority}{item.dueDate?` · due ${new Date(item.dueDate).toLocaleDateString('en-GB')}`:''}</Text>
        <Text style={s.body} numberOfLines={2}>{item.body}</Text>
        {item.response?<View style={s.answer}><Text style={s.answerLabel}>ANSWER</Text><Text style={s.answerText} numberOfLines={2}>{item.response}</Text></View>:null}
      </TouchableOpacity>}
      ListEmptyComponent={<Text style={s.empty}>No RFIs.</Text>}/>

    <Modal visible={modal} transparent animationType="slide"><View style={s.back}><View style={s.modal}><Text style={s.modalTitle}>New RFI</Text><ScrollView>
      <Label text="Project"><View style={s.chips}>{projects.map(p=><Chip key={p.id} text={p.name} on={form.projectId===p.id} press={()=>setForm({...form,projectId:p.id})}/>)}</View></Label>
      <Label text="Subject *"><TextInput style={s.input} value={form.subject} onChangeText={v=>setForm({...form,subject:v})} placeholder="Clarify bracket fixing detail" placeholderTextColor={Colors.t3}/></Label>
      <Label text="Question *"><TextInput multiline style={[s.input,s.multi]} value={form.body} onChangeText={v=>setForm({...form,body:v})} placeholder="State the issue, location and information required…" placeholderTextColor={Colors.t3}/></Label>
      <Label text="Priority"><View style={s.chips}>{priorities.map(p=><Chip key={p} text={p} on={form.priority===p} press={()=>setForm({...form,priority:p})}/>)}</View></Label>
      <Label text="Assignee"><TextInput style={s.input} value={form.assignee} onChangeText={v=>setForm({...form,assignee:v})} placeholder="Architect / engineer / client" placeholderTextColor={Colors.t3}/></Label>
      <Label text="Due date"><TextInput style={s.input} value={form.dueDate} onChangeText={v=>setForm({...form,dueDate:v})} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.t3}/></Label>
    </ScrollView><Actions cancel={()=>setModal(false)} save={save} saving={saving} label="Raise RFI"/></View></View></Modal>

    <Modal visible={!!active} transparent animationType="slide"><View style={s.back}><View style={s.modal}>{active&&<><Text style={s.modalTitle}>{active.number} · {active.subject}</Text><ScrollView>
      <Text style={s.detail}>{active.body}</Text>
      <Text style={s.meta}>{active.assignee||'Unassigned'}{active.dueDate?` · due ${new Date(active.dueDate).toLocaleDateString('en-GB')}`:''}</Text>
      <Label text="Response"><TextInput editable={canManage} multiline style={[s.input,s.multi,!canManage&&{opacity:.65}]} value={response} onChangeText={setResponse} placeholder={canManage?'Record the formal response…':'Read-only for your role'} placeholderTextColor={Colors.t3}/></Label>
      {canManage?<View style={s.actionStack}>
        {active.status==='open'&&<TouchableOpacity style={s.primary} disabled={saving||!response.trim()} onPress={()=>update(active,{response:response.trim(),status:'answered'})}><Text style={s.primaryText}>Save answer</Text></TouchableOpacity>}
        {active.status!=='closed'&&<TouchableOpacity style={s.secondary} disabled={saving} onPress={()=>update(active,{...(response.trim()?{response:response.trim()}:{}),status:'closed'})}><Text style={s.secondaryText}>Close RFI</Text></TouchableOpacity>}
        {active.status==='closed'&&<TouchableOpacity style={s.secondary} disabled={saving} onPress={()=>update(active,{status:'open'})}><Text style={s.secondaryText}>Reopen</Text></TouchableOpacity>}
      </View>:null}
    </ScrollView><Actions cancel={()=>{setActive(null);setResponse('')}} save={()=>{}} saving={false} label="" hideSave/></>}</View></View></Modal>
  </View>
}
function Label({text,children}:{text:string;children:React.ReactNode}){return<View style={{marginTop:12}}><Text style={s.label}>{text}</Text>{children}</View>}
function Chip({text,on,press}:{text:string;on:boolean;press:()=>void}){return<TouchableOpacity onPress={press} style={[s.chip,on&&s.chipOn]}><Text style={[s.chipText,on&&s.chipTextOn]}>{text}</Text></TouchableOpacity>}
function Actions({cancel,save,saving,label,hideSave=false}:{cancel:()=>void;save:()=>void;saving:boolean;label:string;hideSave?:boolean}){return<View style={s.actions}><TouchableOpacity style={s.cancel} onPress={cancel}><Text style={{color:Colors.t2}}>Cancel</Text></TouchableOpacity>{!hideSave&&<TouchableOpacity style={s.primary} onPress={save} disabled={saving}><Text style={s.primaryText}>{saving?'Saving…':label}</Text></TouchableOpacity>}</View>}
const s=StyleSheet.create({wrap:{flex:1,backgroundColor:Colors.ink},center:{flex:1,backgroundColor:Colors.ink,alignItems:'center',justifyContent:'center'},header:{padding:20,paddingBottom:10,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'},kicker:{color:Colors.amber,fontSize:9,fontWeight:'900',letterSpacing:1.3},h1:{color:Colors.t1,fontSize:28,fontWeight:'900'},sub:{color:Colors.t2,fontSize:10,marginTop:3},add:{color:Colors.amber,fontSize:12,fontWeight:'900'},err:{color:Colors.red,paddingHorizontal:20},list:{padding:20,paddingTop:8,paddingBottom:40},card:{backgroundColor:Colors.ink3,borderWidth:1,borderColor:Colors.hair,borderRadius:14,padding:13,marginBottom:9},between:{flexDirection:'row',justifyContent:'space-between',gap:8},num:{color:Colors.amber,fontSize:9,fontWeight:'900'},status:{fontSize:8,fontWeight:'900'},title:{color:Colors.t1,fontSize:13,fontWeight:'900',marginTop:6},meta:{color:Colors.t3,fontSize:9.5,marginTop:4},body:{color:Colors.t2,fontSize:10.5,lineHeight:15,marginTop:7},answer:{borderLeftWidth:2,borderLeftColor:Colors.blue,paddingLeft:9,marginTop:9},answerLabel:{color:Colors.blue,fontSize:8,fontWeight:'900'},answerText:{color:Colors.t2,fontSize:10,marginTop:3},empty:{color:Colors.t3,textAlign:'center',padding:30},back:{flex:1,backgroundColor:'rgba(0,0,0,.68)',justifyContent:'flex-end'},modal:{backgroundColor:Colors.ink2,borderTopLeftRadius:22,borderTopRightRadius:22,padding:20,maxHeight:'88%'},modalTitle:{color:Colors.t1,fontSize:18,fontWeight:'900',marginBottom:4},label:{color:Colors.t2,fontSize:10,fontWeight:'800',marginBottom:6},input:{borderWidth:1,borderColor:Colors.hair,borderRadius:11,backgroundColor:Colors.ink3,color:Colors.t1,paddingHorizontal:11,paddingVertical:10,fontSize:11},multi:{minHeight:90,textAlignVertical:'top'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{borderWidth:1,borderColor:Colors.hair,borderRadius:10,paddingHorizontal:9,paddingVertical:7},chipOn:{borderColor:Colors.amber,backgroundColor:Colors.amber+'12'},chipText:{color:Colors.t2,fontSize:9.5,fontWeight:'800'},chipTextOn:{color:Colors.amber},actions:{flexDirection:'row',gap:8,marginTop:16},cancel:{flex:1,borderWidth:1,borderColor:Colors.hair,borderRadius:11,padding:12,alignItems:'center'},primary:{flex:1,backgroundColor:Colors.amber,borderRadius:11,padding:12,alignItems:'center'},primaryText:{color:Colors.ink,fontWeight:'900'},secondary:{borderWidth:1,borderColor:Colors.blue+'77',borderRadius:11,padding:12,alignItems:'center'},secondaryText:{color:Colors.blue,fontWeight:'900'},detail:{color:Colors.t1,fontSize:11.5,lineHeight:17,marginTop:10},actionStack:{gap:8,marginTop:14}});

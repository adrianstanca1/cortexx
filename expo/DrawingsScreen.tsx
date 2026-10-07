import React,{useEffect,useMemo,useState}from'react';
import{View,Text,FlatList,TouchableOpacity,StyleSheet,RefreshControl,ActivityIndicator,Modal,Alert,Linking}from'react-native';
import{Colors,API_URL}from'./theme';
import{getCollection,apiGet}from'./api';

type Revision={id:string;revision:string;fileUrl?:string|null;fileName?:string|null;uploadedAt:string;notes?:string|null;_count?:{markups:number}};
type Drawing={id:string;projectId:string;number:string;title:string;discipline?:string|null;status:string;project?:{id:string;name:string}|null;revisions?:Revision[];_count?:{revisions:number}};

export default function DrawingsScreen({onLogout}:{onLogout:()=>void}){
  const[items,setItems]=useState<Drawing[]>([]),[loading,setLoading]=useState(true),[err,setErr]=useState(''),[active,setActive]=useState<Drawing|null>(null),[detailLoading,setDetailLoading]=useState(false);
  const load=async()=>{setLoading(true);setErr('');try{const d=await getCollection('drawings',200);setItems((d||[])as Drawing[])}catch(e:any){setErr(e?.message||'Failed to load drawings');if(e?.message==='unauthorized')onLogout()}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
  const open=async(item:Drawing)=>{setActive(item);setDetailLoading(true);try{const d=await apiGet(`/api/drawings/${item.id}`);setActive(d?.drawing||item)}catch(e:any){Alert.alert('Drawing',e?.message||'Failed to load revisions')}finally{setDetailLoading(false)}};
  const current=(d:Drawing)=>d.revisions?.[0];
  const approved=useMemo(()=>items.filter(x=>x.status==='approved').length,[items]);
  if(loading)return<View style={s.center}><ActivityIndicator color={Colors.amber}/></View>;
  return<View style={s.wrap}>
    <View style={s.header}><Text style={s.kicker}>CONTROLLED INFORMATION</Text><Text style={s.h1}>Drawings</Text><Text style={s.sub}>{items.length} drawings · {approved} approved</Text></View>
    {err?<Text style={s.err}>{err}</Text>:null}
    <FlatList data={items} keyExtractor={i=>i.id} refreshControl={<RefreshControl tintColor={Colors.amber} refreshing={loading} onRefresh={load}/>} contentContainerStyle={s.list}
      renderItem={({item})=>{const rev=current(item);return<TouchableOpacity style={s.card} onPress={()=>void open(item)}>
        <View style={s.between}><Text style={s.num}>{item.number}</Text><Text style={[s.status,{color:item.status==='approved'?Colors.green:item.status==='superseded'?Colors.red:Colors.amber}]}>{item.status.toUpperCase()}</Text></View>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.meta}>{item.project?.name||'Project'}{item.discipline?` · ${item.discipline}`:''}</Text>
        <View style={s.revRow}><Text style={s.rev}>{rev?`REV ${rev.revision}`:'NO REVISION'}</Text><Text style={s.meta}>{item._count?.revisions??item.revisions?.length??0} rev · {rev?._count?.markups||0} markups</Text></View>
      </TouchableOpacity>}}
      ListEmptyComponent={<Text style={s.empty}>No drawings available for your assigned projects.</Text>}/>
    <Modal visible={!!active} transparent animationType="slide"><View style={s.back}><View style={s.modal}>{active&&<>
      <Text style={s.modalTitle}>{active.number} · {active.title}</Text><Text style={s.meta}>{active.project?.name||'Project'} · {active.status}</Text>
      {detailLoading?<ActivityIndicator style={{margin:24}} color={Colors.amber}/>:<FlatList data={active.revisions||[]} keyExtractor={r=>r.id} style={{marginTop:12}} renderItem={({item,index})=><View style={s.revisionCard}>
        <View style={s.between}><Text style={s.rev}>REV {item.revision}</Text>{index===0?<Text style={s.current}>CURRENT</Text>:null}</View>
        <Text style={s.meta}>{new Date(item.uploadedAt).toLocaleString('en-GB')}{item.fileName?` · ${item.fileName}`:''}</Text>
        {item.notes?<Text style={s.note}>{item.notes}</Text>:null}
        <Text style={s.meta}>{item._count?.markups||0} annotations</Text>
        {item.fileUrl?<TouchableOpacity style={s.openBtn} onPress={()=>{const url=/^https?:\/\//i.test(item.fileUrl!)?item.fileUrl!:`${API_URL}${item.fileUrl!.startsWith('/')?'':'/'}${item.fileUrl!}`;Linking.openURL(url).catch(()=>Alert.alert('File','Unable to open drawing file.'))}}><Text style={s.openText}>Open revision file</Text></TouchableOpacity>:<Text style={s.noFile}>No file attached</Text>}
      </View>} ListEmptyComponent={<Text style={s.empty}>No revisions uploaded.</Text>}/>}
      <TouchableOpacity style={s.close} onPress={()=>setActive(null)}><Text style={s.closeText}>Close</Text></TouchableOpacity>
    </>}</View></View></Modal>
  </View>
}
const s=StyleSheet.create({wrap:{flex:1,backgroundColor:Colors.ink},center:{flex:1,backgroundColor:Colors.ink,alignItems:'center',justifyContent:'center'},header:{padding:20,paddingBottom:10},kicker:{color:Colors.amber,fontSize:9,fontWeight:'900',letterSpacing:1.3},h1:{color:Colors.t1,fontSize:28,fontWeight:'900'},sub:{color:Colors.t2,fontSize:10,marginTop:3},err:{color:Colors.red,paddingHorizontal:20},list:{padding:20,paddingTop:8,paddingBottom:40},card:{backgroundColor:Colors.ink3,borderWidth:1,borderColor:Colors.hair,borderRadius:14,padding:13,marginBottom:9},between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},num:{color:Colors.amber,fontSize:10,fontWeight:'900'},status:{fontSize:8,fontWeight:'900'},title:{color:Colors.t1,fontSize:13,fontWeight:'900',marginTop:6},meta:{color:Colors.t3,fontSize:9.5,marginTop:4},revRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:10},rev:{color:Colors.blue,fontSize:9,fontWeight:'900'},empty:{color:Colors.t3,textAlign:'center',padding:30},back:{flex:1,backgroundColor:'rgba(0,0,0,.68)',justifyContent:'flex-end'},modal:{backgroundColor:Colors.ink2,borderTopLeftRadius:22,borderTopRightRadius:22,padding:20,maxHeight:'88%'},modalTitle:{color:Colors.t1,fontSize:18,fontWeight:'900'},revisionCard:{borderWidth:1,borderColor:Colors.hair,borderRadius:13,padding:12,marginBottom:8,backgroundColor:Colors.ink3},current:{color:Colors.green,fontSize:8,fontWeight:'900'},note:{color:Colors.t2,fontSize:10.5,lineHeight:15,marginTop:7},openBtn:{backgroundColor:Colors.blue+'22',borderWidth:1,borderColor:Colors.blue+'66',borderRadius:10,padding:10,alignItems:'center',marginTop:10},openText:{color:Colors.blue,fontWeight:'900',fontSize:10},noFile:{color:Colors.t3,fontSize:9,marginTop:9},close:{borderWidth:1,borderColor:Colors.hair,borderRadius:11,padding:12,alignItems:'center',marginTop:10},closeText:{color:Colors.t2,fontWeight:'900'}});

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { listLifeHealthCases, type LifeHealthCaseSummary, type LifeHealthStatus, type CaseCounts } from '@/lib/life-health-cases';
import { canPartnerAccessCaseRegister } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const filters: Array<{key:LifeHealthStatus;label:string}> = [
  {key:'pending',label:'Pending'},{key:'rejected',label:'Rejected'},
  {key:'issued',label:'Issued'},{key:'all',label:'All'},
];
const EMPTY: CaseCounts = {pending:0,rejected:0,issued:0,all:0};
const navy='#17365D';
export default function LifeHealthCaseRegisterScreen() {
 const router=useRouter();
 const {context}=usePartnerSession();
 const [status,setStatus]=useState<LifeHealthStatus>('pending');
 const [query,setQuery]=useState('');
 const [search,setSearch]=useState('');
 const [rows,setRows]=useState<LifeHealthCaseSummary[]>([]);
 const [counts,setCounts]=useState<CaseCounts>(EMPTY);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(true);
 const [more,setMore]=useState(false);
 const [error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{ const timeout=setTimeout(()=>setSearch(query.trim()),300);return ()=>clearTimeout(timeout);},[query]);
 const load=useCallback(async(offset=0)=>{
   const seq=++generation.current;
   if(offset===0)setLoading(true);else setMore(true);
   setError('');
   try {
     const result=await listLifeHealthCases({status,search,offset,limit:10});
     if(seq!==generation.current)return;
     setRows(old=>offset===0?result.cases:[...old,...result.cases.filter(row=>!old.some(existing=>existing.id===row.id))]);
     setCounts(result.counts);
     setTotal(result.total);
   } catch(cause) {
     if(seq===generation.current)setError(cause instanceof Error?cause.message:'Unable to load cases.');
   } finally {
     if(seq===generation.current){setLoading(false);setMore(false);}
   }
 },[status,search]);
 useFocusEffect(useCallback(()=>{
   void load();
   return ()=>{generation.current++;};
 },[load]));
 if(!canPartnerAccessCaseRegister(context))return (
   <PartnerScreen title="Case Register" onBack={()=>router.back()}>
     <Text style={styles.message}>Your Operations Portal permissions do not allow Case Register access.</Text>
   </PartnerScreen>
 );
 return (
   <PartnerScreen title="Case Register" subtitle="Life & Health cases" onBack={()=>router.back()}>
     <View style={styles.searchWrap}>
       <Ionicons name="search-outline" size={19} color="#63748A"/>
       <TextInput value={query} onChangeText={setQuery} style={styles.search}
         placeholder="Case, customer, mobile, insurer, proposal..." placeholderTextColor="#8390A5" autoCapitalize="none"/>
       {query?<Pressable accessibilityLabel="Clear case search" onPress={()=>setQuery('')}><Ionicons name="close-circle" size={18} color="#70819A"/></Pressable>:null}
     </View>
     <View style={styles.filters}>
       {filters.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityState={{selected:status===item.key}}
           onPress={()=>setStatus(item.key)} style={[styles.filter,status===item.key&&styles.filterSelected]}>
           <Text style={[styles.filterText,status===item.key&&styles.filterTextSelected]}>{item.label} ({counts[item.key]})</Text>
       </Pressable>)}
     </View>
     {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
       <Pressable onPress={()=>void load()}><Text style={styles.retry}>Retry</Text></Pressable></View>:null}
     {loading?<ActivityIndicator color={navy} style={{marginTop:24}}/>:
       rows.length===0?<Text style={styles.message}>No matching cases found.</Text>:
       <View style={styles.list}>
         {rows.map(row=><Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Open case ${row.case_number}`}
            onPress={()=>router.push(`/life-health-cases/${row.id}` as never)} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.caseNo}>{row.case_number}</Text>
              <Text style={[styles.chip,row.status_group==='issued'?styles.issued:row.status_group==='rejected'?styles.rejected:styles.pending]}>{row.status_group.toUpperCase()}</Text>
            </View>
            <Text style={styles.customer} numberOfLines={1}>{row.customer_name} · {row.business_line}</Text>
            <Text style={styles.meta} numberOfLines={2}>{row.insurer_name} · {row.product_name}</Text>
            <Text style={styles.meta}>Proposal: {row.proposal_number||'—'} · RM: {row.rm_name||'—'}</Text>
            <View style={styles.foot}>
              <Text style={styles.amount}>₹{row.premium_amount.toLocaleString('en-IN',{maximumFractionDigits:2})}</Text>
              <Ionicons name="chevron-forward" size={19} color="#496CA1"/>
            </View>
         </Pressable>)}
         {rows.length<total?<Pressable disabled={more} style={styles.more} onPress={()=>void load(rows.length)}>
           {more?<ActivityIndicator color={navy}/>:<Text style={styles.moreText}>Load More ({rows.length} of {total})</Text>}
         </Pressable>:null}
       </View>}
   </PartnerScreen>
 );
}
const styles=StyleSheet.create({
 searchWrap:{flexDirection:'row',alignItems:'center',borderRadius:12,borderWidth:1,borderColor:'#CBD8E7',backgroundColor:'#FFF',paddingHorizontal:12,height:44,gap:8,marginTop:8},
 search:{flex:1,color:'#172B4D',fontSize:12},
 filters:{flexDirection:'row',gap:5,flexWrap:'wrap',marginTop:12,marginBottom:8},
 filter:{borderRadius:10,borderColor:'#D6E0EE',borderWidth:1,paddingVertical:9,paddingHorizontal:10,backgroundColor:'#FFF'},
 filterSelected:{backgroundColor:navy,borderColor:navy},
 filterText:{fontSize:11,color:'#49617D',fontWeight:'700'},
 filterTextSelected:{color:'#FFF'},
 list:{gap:9,paddingBottom:20},
 card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#DFE7F1',borderRadius:13,padding:12,gap:5},
 cardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},
 caseNo:{fontWeight:'800',fontSize:13,color:navy,flex:1},
 chip:{overflow:'hidden',fontSize:9,fontWeight:'800',paddingHorizontal:8,paddingVertical:5,borderRadius:8},
 issued:{backgroundColor:'#E6F6EE',color:'#16684A'},
 rejected:{backgroundColor:'#FEECEC',color:'#A22D36'},
 pending:{backgroundColor:'#FFF2D8',color:'#956516'},
 customer:{fontWeight:'700',fontSize:12,color:'#233A5A'},
 meta:{fontSize:11,color:'#64748B'},
 foot:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:5},
 amount:{fontSize:13,fontWeight:'800',color:navy},
 more:{alignSelf:'center',padding:12},
 moreText:{color:navy,fontWeight:'800',fontSize:12},
 error:{padding:12,backgroundColor:'#FEF0EF',borderRadius:10,marginVertical:8},
 errorText:{color:'#A22D36',fontSize:12},
 retry:{color:'#174A96',fontWeight:'800',marginTop:8},
 message:{textAlign:'center',color:'#66758C',fontSize:12,marginTop:25},
});

import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function parseIso(value: string) {
  if (!ISO.test(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear()===year && parsed.getMonth()===month-1 && parsed.getDate()===day ? parsed : new Date();
}
function fromIndianDate(value: string) {
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if(!match)return null;
  const [,day,month,year]=match;
  const parsed=parseIso(year+'-'+month+'-'+day);
  return parsed.getDate()===Number(day)&&parsed.getMonth()+1===Number(month)&&parsed.getFullYear()===Number(year)?year+'-'+month+'-'+day:null;
}
function toIso(value: Date) {
  return [String(value.getFullYear()).padStart(4,'0'),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
}
export function displayIndianDate(iso: string) {
  if (!ISO.test(iso)) return 'DD/MM/YYYY';
  const [year,month,day] = iso.split('-');
  return day+'/'+month+'/'+year;
}

export function PartnerPolicyDateField({label,value,onChange,required=false,hidePlaceholder=false,fullWidth=false}:{label:string;value:string;onChange:(iso:string)=>void;required?:boolean;hidePlaceholder?:boolean;fullWidth?:boolean}) {
  const [pickerOpen,setPickerOpen] = useState(false);
  const [webInput,setWebInput] = useState('');
  const selected=parseIso(value);
  const select=(event:DateTimePickerEvent, date?:Date)=>{
    if (Platform.OS==='android') setPickerOpen(false);
    if(event.type==='set'&&date) onChange(toIso(date));
  };
  return <View style={[styles.field,fullWidth&&styles.fullWidth]}>
    <Text style={styles.label}>{label}{required?<Text style={styles.star}> *</Text>:null}</Text>
    {Platform.OS==='web' ? (
      <View style={styles.row}>
        <TextInput accessibilityLabel={label} value={webInput|| (value?displayIndianDate(value):'')} onChangeText={v=>{setWebInput(v);const iso=fromIndianDate(v);if(iso){onChange(iso);setWebInput('');}}} onBlur={()=>setWebInput('')} placeholder={hidePlaceholder?"":"DD/MM/YYYY"} placeholderTextColor="#9AA7B9" style={styles.webInput}/>
        <Ionicons name="calendar-outline" size={17} color="#315B9A"/>
      </View>
    ) : (
      <Pressable accessibilityRole="button" accessibilityLabel={label+' calendar picker'} onPress={()=>setPickerOpen(true)} style={styles.row}>
        <Text style={[styles.value,!value&&styles.placeholder]}>{value?displayIndianDate(value):hidePlaceholder?'':'DD/MM/YYYY'}</Text>
        <Ionicons name="calendar-outline" size={17} color="#315B9A"/>
      </Pressable>
    )}
    {pickerOpen&&Platform.OS!=='web'?<DateTimePicker value={selected} mode="date" display={Platform.OS==='ios'?'spinner':'default'} onChange={select}/>:null}
    {pickerOpen&&Platform.OS==='ios'?<Pressable accessibilityRole="button" onPress={()=>setPickerOpen(false)} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable>:null}
  </View>;
}
const styles=StyleSheet.create({
  field:{width:'48%',minWidth:0,gap:5},fullWidth:{width:'100%'},label:{fontSize:10,color:'#65758E',fontWeight:'700'},star:{color:'#B93333'},
  row:{minHeight:42,borderWidth:1,borderColor:'#D8E1EC',borderRadius:9,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFFFFF',gap:5},
  value:{fontSize:12,color:'#183653',flex:1},placeholder:{color:'#97A5B7'},webInput:{flex:1,fontSize:12,color:'#183653',minHeight:38},
  done:{alignSelf:'flex-end',padding:10},doneText:{fontSize:12,fontWeight:'700',color:'#315B9A'}
});

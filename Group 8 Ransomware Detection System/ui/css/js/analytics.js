window.onload=function(){

const ctx=document.getElementById("threatChart");

new Chart(ctx,{
type:"line",
data:{
labels:["10:40","10:41","10:42","10:43","10:44"],
datasets:[{
label:"Threat Score",
data:[0.2,0.4,0.9,0.3,0.6],
borderWidth:2
}]
},
options:{
responsive:true,
maintainAspectRatio:false
}
});

};

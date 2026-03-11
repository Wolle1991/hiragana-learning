
const data=[
{h:"あ",r:"a"},
{h:"い",r:"i"},
{h:"う",r:"u"},
{h:"え",r:"e"},
{h:"お",r:"o"},
{h:"か",r:"ka"},
{h:"き",r:"ki"},
{h:"く",r:"ku"},
{h:"け",r:"ke"},
{h:"こ",r:"ko"},
{h:"さ",r:"sa"},
{h:"し",r:"shi"},
{h:"す",r:"su"},
{h:"せ",r:"se"},
{h:"そ",r:"so"},
{h:"た",r:"ta"},
{h:"ち",r:"chi"},
{h:"つ",r:"tsu"},
{h:"て",r:"te"},
{h:"と",r:"to"}
]

let correct=0
let wrong=0
let streak=0
let current

function newQuestion(){

current=data[Math.floor(Math.random()*data.length)]

document.getElementById("symbol").innerText=current.h

let options=[current.r]

while(options.length<4){
let r=data[Math.floor(Math.random()*data.length)].r
if(!options.includes(r)) options.push(r)
}

options.sort(()=>Math.random()-0.5)

const container=document.getElementById("answers")
container.innerHTML=""

options.forEach(o=>{
let b=document.createElement("button")
b.innerText=o
b.onclick=()=>check(o)
container.appendChild(b)
})

document.getElementById("result").innerText=""
}

function check(answer){

if(answer===current.r){
correct++
streak++
document.getElementById("result").innerText="✅ Richtig"
}else{
wrong++
streak=0
document.getElementById("result").innerText="❌ Falsch ("+current.r+")"
}

updateStats()
}

function updateStats(){
document.getElementById("correct").innerText=correct
document.getElementById("wrong").innerText=wrong
document.getElementById("streak").innerText=streak
}

document.getElementById("next").onclick=newQuestion

newQuestion()

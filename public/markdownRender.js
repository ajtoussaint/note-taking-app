import defaultExport from 'markdown-it'
let target = document.getElementById("renderedText");
let markedServer = document.getElementById("plainText")

window.onload = function(){
  console.log("YEEHAW")
  target.innerHTML = markedServer.innerHTML
}

  document.getElementById('createNoteNote').addEventListener('keydown', (e) => {
    //when tab key is pressed in the
    if(e.keyCode === 9 ) {
      console.log("HELLO!");
      e.preventDefault()


      let start = this.selectionStart;
      let end = this.selectionEnd;



      this.value = this.value.substring(0,start) + "\t" + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 1;
    }
  })

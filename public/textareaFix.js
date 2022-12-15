  let textArea = document.getElementById('createNoteNote')

  textArea.addEventListener('keydown', (e) => {
    //when tab key is pressed in the
    if(e.keyCode === 9 ) {
      e.preventDefault()
      let start = textArea.selectionStart;
      let end = textArea.selectionEnd;
      textArea.value = textArea.value.substring(0,start) + "\t" + textArea.value.substring(end);
      textArea.selectionStart = textArea.selectionEnd = start + 1;
    }
  })

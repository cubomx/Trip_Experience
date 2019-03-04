
var socket = io.connect('http://localhost:3000', {'forceNew': true});

function getMetadata(){
  let files = document.getElementById('files').files
  console.log(files)
  socket.emit('getMetadata', files)
}

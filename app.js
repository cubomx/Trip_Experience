const express = require('express');
const morgan =  require('morgan');
var videoshow = require('videoshow');
const bodyParser = require('body-parser')
const request = require('request')
const port = 3000
const routes = require('./routes');
const exif = require('exiftool');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: './upload' });
var app = express()
const server = require('http').Server(app)
server.listen(port, () =>{
  console.log('Server initialized');
  console.log('App name: ', app.get('appName'));
});
const io = require('socket.io')(server)
var files
var file
var videoOptions = {
  fps: 25,
  loop: 5,
  transition: true,
  transitionDuration: 1,
  videoBitrate: 1024,
  videoCodec: 'libx264',
  size: '1024x?',
  format: 'mp4',
  pixelFormat: 'yuv420p'
}

app.set('appName', 'Trip Experience');

app.use(morgan('short'));

app.use(express.static('public'));
//routings
app.use(routes);

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false}))

app.post('/upload', upload.array('files'), (req, res) =>{
  files = req.files
  let gps = ""
  let paths = new Array()
  let aux = files[0]
  files[0] = files[1]
  files[1] = aux
  let orden = new Array()
  /*for(let j = 0; j < files.length; j++){
    fs.readFile(files[j])
  }*/

  for(let i = 0; i < files.length; i++){
    var json = {"path": 'im.png', "date": 2019}
    var info = [{"date":23}]
    let url = 'http://gcsproject-api.000webhostapp.com/staticmap.php/?center='
    let zoomSize = '&zoom=17&size=1024x576'
    let mark ='&maptype=mapnik&markers='
    let date
    fs.readFile(files[i].path, (err, data) =>{
      if (err)
        throw err;
      else{
        exif.metadata(data, (err, metadata) =>{
          if (err)
            throw err;
          else {
            date = metadata['createDate']
            console.log(date)
            gps = metadata['gpsPosition']
            gps = gps.split(' ')
            gpsLocation = new Array()
            for(let j = 0; j < 2; j++){
              gpsLocation.push(parseFloat(gps[0+(j*5)]) + (parseFloat(gps[2+(j*5)])/60) + (parseFloat(gps[3+(j*5)])/3600))
            }
            let pos = gpsLocation[0] + ',' + (gpsLocation[1])*-1
            url+= pos + zoomSize + mark + pos + ',lightblue1'
            download(url, i+'1image.png', function(){
              console.log('done');
            })
          };
        });
      };
    });
  };
  videoshow(files, videoOptions)
  .save('video.mp4')
  .on('start', (command) =>{
    console.log('ffmpeg process started:', command)
  })
  .on('error', (err, stdout, stderr) =>{
    console.error('Error:', err)
    console.error('ffmpeg stderr:', stderr)
  })
  .on('end', (output) =>{
    console.error('Video created in:', output);
    res.sendfile(output)
  })
});

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
  console.log('content-type:', res.headers['content-type']);
  console.log('content-length:', res.headers['content-length']);
  var writeStream = fs.createWriteStream(filename)
  file = request(uri).pipe(writeStream).on('close', callback);
  });
};


module.exports = server;

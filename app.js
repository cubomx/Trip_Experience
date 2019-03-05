const express = require('express');
const sharp = require('sharp');
const morgan =  require('morgan');
var videoshow = require('videoshow');
var clone = require('clone');
const bodyParser = require('body-parser')
const request = require('request')
const port = 3000
const routes = require('./routes');
const exif = require('exiftool');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: './upload' });
var app = express()
var sortJsonArray = require('sort-json-array');
const server = require('http').Server(app)
server.listen(port, () =>{
  console.log('Server initialized');
  console.log('App name: ', app.get('appName'));
});
const io = require('socket.io')(server)
var files
var paths = []
var info = []
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

function getData(fileList){
  return new Promise( (resolve, reject) =>{
    files = fileList
    let gps = ""
    var index = 0
    for(let i = 0; i < files.length; i++){
      sharp(files[i].path)
      .resize(1024, 576)
      .ignoreAspectRatio()
      .toFile(files[i].path+i)
      .then( (data) => {} )
      .catch( (err) =>{reject(err)})
      var json = {"path": 'im.png', "date": 2019, "position": '2929232'}
      let url = 'http://gcsproject-api.000webhostapp.com/staticmap.php/?center='
      let zoomSize = '&zoom=17&size=1024x576'
      let mark ='&maptype=mapnik&markers='
      let date
      fs.readFile(files[i].path, (err, data) =>{
        let numberDate = 0
        if (err)
          reject(err);
        else{
          exif.metadata(data, (err, metadata) =>{
            if (err)
              throw err;
            else {
              date = metadata['createDate']
              date = date.split(/[: \s]/)
              numberDate += parseFloat(date[0])
              numberDate += parseFloat(date[1])*2
              numberDate += parseFloat(date[2]/30)
              numberDate += ((parseFloat (date[3]))+1)/(60*12)
              numberDate += ((parseFloat(date[4]))+1)/(60*12*60)
              numberDate += ((parseFloat (date[5]))+1)/(60*12*60*60)
              gps = metadata['gpsPosition']
              gps = gps.split(' ')
              gpsLocation = new Array()
              for(let j = 0; j < 2; j++){
                gpsLocation.push(parseFloat(gps[0+(j*5)]) + (parseFloat(gps[2+(j*5)])/60) + (parseFloat(gps[3+(j*5)])/3600))
              }
              let pos = gpsLocation[0] + ',' + (gpsLocation[1])*-1
              info[i] = clone(json)

              info[i].date = numberDate
              info[i].path = files[i].path + i
              paths.push(i+'1image.png')
              paths.push(files[i].path + i)
              info[i].position = pos
              url+= pos + zoomSize + mark + pos + ',lightblue1'
              console.log(info)

              download(url, i+'1image.png', function(){
                console.log('done');
                index += 1
                console.log(index + ' phto')
                if (index == files.length){
                  resolve(paths)
                }
              })
            };
          })
        };

      });
    };
  })
}

app.post('/upload', upload.array('files'), (req, res) =>{
  var data = getData(req.files).then(function(result){
    videoshow(result, videoOptions)
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
      sortJsonArray(info, 'date', 'asc');
      res.sendfile(output)

    })
  })
});


var download = function(uri, filename, callback){
  request.head(uri, async function(err, res, body){
  console.log('content-type:', res.headers['content-type']);
  console.log('content-length:', res.headers['content-length']);
  var writeStream = fs.createWriteStream(filename)
  file = await request(uri).pipe(writeStream).on('close', callback);
  });
};


module.exports = server;


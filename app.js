const express = require('express');
const sharp = require('sharp');
const morgan =  require('morgan');
var videoshow = require('videoshow');
var FfmpegCommand = require('fluent-ffmpeg');
var clone = require('clone');
const bodyParser = require('body-parser');
var distance = require('gps-distance');
const concat = require('ffmpeg-concat')
const request = require('request');
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
var jsonN
var paths = []
var info = []

app.set('appName', 'Trip Experience');

app.use(morgan('short'));

app.use(express.static('public'));
//routings
app.use(routes);

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false}))

function sortJson(json){
  return new Promise( (resolve, reject) =>{
      if(json === null){
        reject('Error: null value ')
      }
      resolve(sortJsonArray(json, 'date', 'des'));
  })
}

function getData(fileList){
  return new Promise( (resolve, reject) =>{
    files = fileList
    let gps = ""
    var index = 0
    for(let i = 0; i < files.length; i++){
      var json = {"path": 'im.png', "date": 2019, "position": '2929232', "ext": 'image'}
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
              info[(2*i)] = clone(json)
              info[(2*i) + 1] = clone(json)
              let type = metadata['mimeType'].split("/")
              if (type[0] != 'video'){
                sharp(files[i].path)
                .resize(1024, 576)
                .ignoreAspectRatio()
                .toFile(files[i].path+i)
                .then( (data) => {} )
                .catch( (err) =>{reject(err)})
                info[(2*i)].path = files[i].path + i
              }
              else{
                info[(2*i)].path = files[i].path
                info[(2*i)].ext = 'video'
              }
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

              info[(2*i)].date = numberDate

              info[(2*i)].position = pos
              info[(2*i) + 1].date = numberDate + 0.000000001
              info[(2*i) + 1].path = i+'1image.png'
              info[(2*i) + 1].position = pos
              paths.push(i+'1image.png')
              paths.push(files[i].path + i)

              url+= pos + zoomSize + mark + pos + ',lightblue1'

              download(url, i+'1image.png', function(){
                console.log('done');
                index += 1
                sortJson(info).then(function(result){
                  if (index == files.length){
                    resolve(result)
                  }
                } )
              })
            };
          })
        };
      });
    };
  })
}

function getVideos(options, videos){
  return new Promise( (resolve, reject, err) =>{
    if(err){
      reject(err)
    }
    let index = 0
    for(let x = 0; x < videos.length; x++){
      if(videos[x].ext == 'video'){
        FfmpegCommand()
        .input(videos[x].path)
        .size('1024x576')
        .save(x+'video.mp4')
        .on('end', () =>{
          index += 1
          console.log(x+'file')
          if(index == videos.length){
            console.log("6")
            resolve(options)
          }
        })
      }
      else{
        FfmpegCommand()
        .input(videos[x].path)
        .loop(4)
        .save(x+'video.mp4')
        .on('end', () =>{
          index += 1
          console.log(x+'file')
          if(index == videos.length){
            console.log("6")
            resolve(options)
          }
        })
      }
      options.videos.push(x+'video.mp4')

    }
  })
}

async function makeVideo(files){

}

app.post('/upload', upload.array('files'), (req, res) =>{
  var json = null
  var videos = new Array()
  var options = {
    output: 'video.mp4',
    videos: [],
    transition: {
      name: 'swap',
      duration: 50
    }
}
  getData(req.files).then(function(result){
    console.log(result)
    getVideos(options, result).then((response)=>{
      console.log("2")
      makeVideo(response).then(async function(filepath){
        await concat(response)
        res.sendFile(__dirname + '/' + 'video.mp4')
      })
    })


  })
});

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
  console.log('content-type:', res.headers['content-type']);
  console.log('content-length:', res.headers['content-length']);
  var writeStream = fs.createWriteStream(filename)
  request(uri).pipe(writeStream).on('close', callback);
  });
};

module.exports = server;

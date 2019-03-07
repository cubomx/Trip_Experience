const express = require('express');
const morgan =  require('morgan');
var FfmpegCommand = require('fluent-ffmpeg');
const resizeImg = require('resize-img');
var clone = require('clone');
const bodyParser = require('body-parser');
var distance = require('gps-distance');
const geolib = require('geolib')
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
var info = []
let point1 = 0
let point2 = 0
let url = 'http://gcsproject-api.000webhostapp.com/staticmap.php/?'
let center = 'center='
let zoomSize = '&zoom='
let size = '17'
let imgsize = 'size=1024x576'
let mark ='&maptype=mapnik&markers='

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
      resolve(sortJsonArray(json, 'date', 'asc'));
  })
}

function getData(fileList){
  return new Promise( (resolve, reject) =>{
    var info = new Array()
    files = fileList
    let gps = ""
    var index = 0
    for(let i = 0; i < files.length; i++){
      var json = {"path": 'im.png', "date": 2019, "position": '2929232', "ext": 'image'}
      let date
      fs.readFile(files[i].path, (err, data) =>{
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
                resizeImg(fs.readFileSync(files[i].path), {width: 1024, height: 576}).then(buf => {
                  fs.writeFileSync(files[i].path+i, buf);
              });
                info[(2*i)].path = files[i].path + i
              }
              else{
                info[(2*i)].path = files[i].path
                info[(2*i)].ext = 'video'
              }
              date = metadata['createDate']
              let numberDate = ''
              date = date.split(/[: \s]/)
              date.forEach((value) => {
                numberDate += value
              } )
              gps = metadata['gpsPosition']
              gps = gps.split(' ')

              gpsLocation = new Array()
              for(let j = 0; j < 2; j++){
                gpsLocation.push(parseFloat(gps[0+(j*5)]) + (parseFloat(gps[2+(j*5)])/60) + (parseFloat(gps[3+(j*5)])/3600))
              }
              if (gps[4] == 'S'){
                gpsLocation[0] = gpsLocation[0]*(-1)
              }
              if(gps[9] == 'W'){
                gpsLocation[1] = gpsLocation[1]*(-1)
              }
              let pos = gpsLocation[0] + ',' + (gpsLocation[1])

              info[(2*i)].date = parseFloat(numberDate)

              info[(2*i)].position = pos
              info[(2*i) + 1].date = parseFloat(numberDate) - 0.1
              info[(2*i) + 1].path = i+'image.png'
              info[(2*i) + 1].position = pos

              let fullurl = url + center + pos + '&' + imgsize + zoomSize + size + mark + pos + ',lightblue1'
              console.log(fullurl)
              download(fullurl, i+'image.png', function(){
                console.log('done');
                index += 1
                if (index == files.length) {
                  sortJson(info).then(async function(result){
                    point1 = info[0].position.split(',')
                    point2 = info[info.length - 1].position.split(',')
                    let zoom = 5
                    let dist = distance(parseFloat(point1[0]), parseFloat(point1[1]), parseFloat(point2[0]), parseFloat(point2[1]));
                    if (dist <= 1000){
                      if (dist <= 400){
                        zoom = 8
                      }
                      if (dist <= 100){
                        zoom = 10
                      }
                      let centerP = geolib.getCenter([
                        {latitude: parseFloat(point1[0]), longitude: parseFloat(point1[1])},
                        {latitude: parseFloat(point2[0]), longitude: parseFloat(point2[1])}
                      ]);
                      fullurl = url + center + centerP.latitude + ',' + centerP.longitude + '&' + imgsize + zoomSize + zoom + mark + info[0].position + ',' + 'lightblue2' + '|' + info[info.length - 1].position + ','  + 'lightblue3'
                    }
                    else{
                      fullurl = url + imgsize + zoomSize + '2' + mark + info[0].position + ',' + 'lightblue2' + '|' + info[info.length - 1].position + ','  + 'lightblue3'
                    }
                    console.log(fullurl)
                    download(fullurl, (i+'mage.png'), function () {
                      json.date = info[0].date - 10
                      json.position = 0
                      json.path = i+'mage.png'
                      info[(files.length*2)] = clone(json)
                      console.log('first done')
                       sortJson(info).then( (resp) =>{
                         console.log(info)
                         resolve(info)
                       })
                    })
                  })
                }
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
            resolve(options)
          }
        })
      }
      options.videos.push(x+'video.mp4')
    }
  })
}

app.post('/upload', upload.array('files'), (req, res) =>{
  var options = {
    output: 'video.mp4',
    videos: [],
    transition: {
      name: 'swap',
      duration: 50
    }
}
  getData(req.files).then(function(result){
    result[result.length] = clone(result[0])
    getVideos(options, result).then( async function (response){
      console.log("2")
      await concat(response)
      res.sendFile(__dirname + '/' + 'video.mp4')
    })
  })
});

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
  console.log('file:: ', filename);
  console.log('content-type:', res.headers['content-type']);
  console.log('content-length:', res.headers['content-length']);
  var writeStream = fs.createWriteStream(filename)
  request(uri).pipe(writeStream).on('close', callback).on('error', (err) =>{
    console.error(err);
  });
  });
};

module.exports = server;

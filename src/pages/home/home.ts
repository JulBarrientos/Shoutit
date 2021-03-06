import { Component  } from '@angular/core';
import { Media, MediaObject } from '@ionic-native/media';
import { DatePipe } from '@angular/common'

import {AudioData} from '../../class/audio'
import {UserData} from '../../class/user'
import "rxjs/add/operator/map";


import { AlertController, Alert } from 'ionic-angular';


import {File} from '@ionic-native/file';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';

import { AndroidPermissions } from '@ionic-native/android-permissions';

import * as firebase from 'firebase/app';
import {FirebaseApp , AngularFireModule} from 'angularfire2';
import { AngularFireDatabase, FirebaseListObservable } from 'angularfire2/database';

  

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})

export class HomePage {
  items: FirebaseListObservable<AudioData[]>;
  audios: AudioData[];
  usuarios: FirebaseListObservable<UserData[]>;
  recording: boolean=false;
  currentPlaying: MediaObject;
  currentPlayingName: string ="";
  alert: Alert;
  audioRecord: MediaObject;
  timeOut;
  externalRoot: string = '';

  constructor(private datepipe: DatePipe, private media: Media, private transfer: FileTransfer,
              private file: File, private db: AngularFireDatabase, private firebaseApp: FirebaseApp,
              private af: AngularFireModule, private androidPermissions: AndroidPermissions,
              private alertCtrl: AlertController) {
    this.externalRoot = file.externalRootDirectory+"ShoutIt/";
    document.addEventListener("deviceready", this.onDeviceReady, false);          
    androidPermissions.requestPermissions([androidPermissions.PERMISSION.RECORD_AUDIO,androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE]); 
    //this.showAlert()
    const fileTransfer: FileTransferObject = this.transfer.create();
    this.usuarios = db.list("/userProfile");
//--------------------------------  Descarga de imagenes de perfil --------------------------------------------//
    db.list('/userProfile',{preserveSnapshot:true})
      .subscribe(snapshots=>{
        snapshots.forEach(snapshot=>{
          fileTransfer.download(snapshot.val()._imageUrl,file.externalRootDirectory+"ShoutIt/Imagenes/"+snapshot.key+".jpg")
          .then((entry)=>{
            console.log("download complete");
          },(error)=>{
            console.log(error);
          })
        })
      })
//----------------------------- Descarga de audios ----------------------------------------------------------//
    db.list('/Audios', { preserveSnapshot: true})
      .subscribe(snapshots=>{
        snapshots.forEach(snapshot => {
          this.firebaseApp.storage().ref().child("Audios/"+snapshot.val()._name).getDownloadURL().then(function(url) {
          // `url` is the download URL for 'images/stars.jpg
          // This can be downloaded directly:
          fileTransfer.download(url,file.externalRootDirectory+"ShoutIt/Audios/" + snapshot.val()._name)
          .then((entry) => {
            console.log('download complete: ' + entry.toURL());
          }, (error) => {
            console.log(error);
          });

          }).catch(function(error) {
            console.log(error);
          });
      });
    });

    this.items = db.list('/Audios', {
      query: {
        orderByChild: 'timeRecorded'
      }
    });
  }


  
  onDeviceReady():void{
  
  }

  getUsuName(UID): string{
    var name: string ="";
    var snapshotFinished = this.db.object('userProfile/'+ UID,{ preserveSnapshot: true})
    snapshotFinished.subscribe(snapshot => {          
      name = snapshot.val()._name;  
    });
    return name;
  }

  record():void{
    this.recording = !this.recording;
    var nowDate = new Date();
    var nowString = this.datepipe.transform(nowDate, 'yyyy-MM-dd hh:mm:ss').toString();

    var fileName = "audio" + nowString + ".mp3";
    fileName = fileName.replace(/:/gi,".");
    console.log(fileName);

    this.audioRecord = this.media.create(fileName);
    this.audioRecord.onStatusUpdate.subscribe(status => console.log(status)); // fires when file status changes
    this.audioRecord.onSuccess.subscribe(() => {console.log('Action is successful');  this.recording = !this.recording;});
    this.audioRecord.onError.subscribe(error => {console.log('Error!', error);  this.recording = !this.recording;;});
  
    // Recording to a file
    this.audioRecord.startRecord();
    this.showAlert(fileName,nowString);
    console.log("Grabando");
    
    this.timeOut = window.setTimeout(()=> {this.finishRecord(fileName,nowString)}, 4500 );    
  }

  finishRecord(fileName: string, nowString: string){
    window.clearTimeout(this.timeOut);
    this.audioRecord.stopRecord();
    var audioData = new AudioData();
    audioData.Name = fileName;
    audioData.TimeRecorded = nowString;
    audioData.Usu = firebase.auth().currentUser.uid;
    audioData.Duration= this.audioRecord.getDuration();
    console.log("termino grabar");
    this.uploadAudio( audioData);
  }
  stop():void{
    this.currentPlaying.stop()
  }

  
  play(it):void{ 
    console.log(it);
    this.audioRecord = this.media.create(this.file.externalRootDirectory + "ShoutIt/Audios/" +it._name);
    
    this.audioRecord.onStatusUpdate.subscribe(status => console.log(status)); // fires when file status changes
    
    this.audioRecord.onSuccess.subscribe(() => {console.log('Action is successful'); it._playing = false;});
    
    this.audioRecord.onError.subscribe(error => {console.log('Error!', error); it._playing = false;});
     
    if(this.currentPlayingName !="" && this.currentPlayingName != it._name){
      this.stop();
    }
      // play the file
    this.audioRecord.play();
    console.log(this.audioRecord.getDuration());
    it._playing = true;
    this.currentPlaying = this.audioRecord;
    this.currentPlayingName = it._name;
      // pause the file
      //file.pause();
    this.audioRecord.getCurrentPosition().then((position) => {
      console.log(this.audioRecord.getDuration());
      console.log(position);
    });
    
      // get file duration
      //let duration = file.getDuration();
      //console.log(duration);
    
      // skip to 10 seconds (expects int value in ms)
      //file.seekTo(10000);
    
      // stop playing the file
      //file.stop();
    
      // release the native audio resource
      // Platform Quirks:
      // iOS simply create a new instance and the old one will be overwritten
      // Android you must call release() to destroy instances of media when you are done
      //file.release();
      //setTimeout(function() {
      //  this.file.stop();
      //  this.file.release();
      //}, 2000);
  }
  showAlert(fileName: string, nowString: string) {
    this.alert = this.alertCtrl.create({
      title: 'Recording',
      message: "<div class='bars'>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
                + "<div class='bar'></div>"
              + "</div>",
      buttons:[
          {
            text: 'Abort',
            role: 'destructive',
            handler: () => {
              console.log('Destructive clicked');
            }
          },
          {
            text: 'Stop',
            role: 'destructive',
            handler: () => {
              this.alert.dismiss();
              this.finishRecord(fileName, nowString);
              console.log('Destructive clicked');
            }
          }
      ]
    });
    this.alert.present();
  }

  uploadAudio(audioClass: AudioData) {
    console.log("upload imagen enter "+audioClass.Name);
    console.log(this.file.externalRootDirectory);
    (<any>window).resolveLocalFileSystemURL(this.file.externalRootDirectory  + audioClass.Name, (res) => {
        console.log("file");
        res.file((resFile) => {
            console.log("read");
            var reader = new FileReader();
            reader.readAsArrayBuffer(resFile);
            reader.onloadend = (evt: any) => {
                console.log("uploading");
                var imgBlob = new Blob([evt.target.result], { type: 'audio/mp3' });
                var imageStore = this.firebaseApp.storage().ref().child("Audios/"+audioClass.Name);
                imageStore.put(imgBlob).then((res) => {
                  alert('Upload Success');
                  this.items.push(audioClass);
                  
                  this.audioRecord.release();
                }).catch((err) => {
                  alert('Upload Failed' + err);
                })
            }
        })
    })
  }
}

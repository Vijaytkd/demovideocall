// Generate random room name if needed
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
  }
  const roomHash = location.hash.substring(1);
  // console.log(roomHash);
  
  // TODO: Replace with your own channel ID
  const drone = new ScaleDrone('LRg6dUR0yUrZUTjW');
  // Room name needs to be prefixed with 'observable-'
  const roomName = 'observable-' + roomHash;
  const configuration = {
    iceServers: [{
      urls: 'stun:stun.l.google.com:19302'
    }]
  };
  let room;
  let pc;
  
  
  function onSuccess() {};
  function onError(error) {
    console.error(error);
  };
  
  drone.on('open', error => {
    if (error) {
      return console.error(error);
    }
    room = drone.subscribe(roomName);
    room.on('open', error => {
      if (error) {
        onError(error);
      }
    });
    // We're connected to the room and received an array of 'members'
    // connected to the room (including us). Signaling server is ready.
    room.on('members', members => {
      console.log('MEMBERS', members);
      // if (members.length >= 3) {//if more than 2 user in a room - new code
      //   return alert('The room is full');//if more than 2 user in a room - new code
      // }//if more than 2 user in a room - new code
      // If we are the second user to connect to the room we will be creating the offer
      const isOfferer = members.length === 2;
      startWebRTC(isOfferer);
    });
  });
  
  // Send signaling data via Scaledrone
  function sendMessage(message) {
    drone.publish({
      room: roomName,
      message
    });
  }
  
  function startWebRTC(isOfferer) {
    pc = new RTCPeerConnection(configuration);
  
    // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
    // message to the other peer through the signaling server
    pc.onicecandidate = event => {
      if (event.candidate) {
        sendMessage({'candidate': event.candidate});
      }
    };
  
    // If user is offerer let the 'negotiationneeded' event create the offer
    if (isOfferer) {
      pc.onnegotiationneeded = () => {
        pc.createOffer().then(localDescCreated).catch(onError);
      }
    }
  
    // When a remote stream arrives display it in the #remoteVideo element
    pc.ontrack = event => {
      const stream = event.streams[0];
      if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
        remoteVideo.srcObject = stream;
      }
    };
  
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    }).then(stream => {
      // Display your local video in #localVideo element
      localVideo.srcObject = stream;
      // Add your stream to be sent to the conneting peer
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      // =====================resume/pause video====================
      var video_toggle=document.querySelector(".pause");
      video_toggle.onclick=function()
      {
        stream.getVideoTracks()[0].enabled=!(stream.getVideoTracks()[0].enabled);//video pause/resume function
        if(stream.getVideoTracks()[0].enabled==true){//checking if users video paused/not
          $("#pause").addClass('fa-video');
          $("#pause").removeClass('fa-video-slash');
        }else{
          $("#pause").addClass('fa-video-slash');
          $("#pause").removeClass('fa-video');
        }
      }
      // ===================resume/pause video======================
      // =========================mute/unmute audio=============================
      var audio_toggle=document.querySelector(".mute");
      audio_toggle.onclick=function()
      {
        stream.getAudioTracks()[0].enabled=!(stream.getAudioTracks()[0].enabled);
        if(stream.getAudioTracks()[0].enabled==true){
          $("#mute").addClass('fa-microphone');
          $("#mute").removeClass('fa-microphone-slash');
          //$("#color").css("background-color","red");
        }else{
          $("#mute").addClass('fa-microphone-slash');
          $("#mute").removeClass('fa-microphone');
          //$("#color").css("background-color","yellow");
        }
      }
      // =========================mute/unmute audio=============================
    }, onError);
  
    // Listen to signaling data from Scaledrone
    room.on('data', (message, client) => {
      // Message was sent by us
      if (client.id === drone.clientId) {
        return;
      }
  
      if (message.sdp) {
        // This is called after receiving an offer or answer from another peer
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
          // When receiving an offer lets answer it
          if (pc.remoteDescription.type === 'offer') {
            pc.createAnswer().then(localDescCreated).catch(onError);
          }
        }, onError);
      } else if (message.candidate) {
        // Add the new ICE candidate to our connections remote description
        pc.addIceCandidate(
          new RTCIceCandidate(message.candidate), onSuccess, onError
        );
      }
    });
  }
  
  function localDescCreated(desc) {
    pc.setLocalDescription(
      desc,
      () => sendMessage({'sdp': pc.localDescription}),
      onError
    );
  }
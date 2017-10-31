IN DEVELOPMENT

Wevr is the one-stop-shop for adding social (i.e. multiuser) capabilities to your VR website built with aframe https://aframe.io/

Just by adding the script tag to your page (after the aframe import), wevr will add player elements for camera, head tracking, hands, movement and interactions control.

Avatars for every user who visits your page will be created, with hands if they have them. Microphone audio will also be enabled automatically so you can see and hear each other,
with positional audio if supported (i.e. Firefox).

Finally wevr has support for game scope state (i.e. key/value pairs that are synched to all users, as well as any new users who join later). Documentation to follow.

Just add:

    <script src="https://jayber.github.io/wevr/dist/wevr.js"></script>

to your page. (Only tested with A-Frame 0.6.1 and above)

Wevr uses WebRTC to sync players with avatars and broadcast audio, the web audio API for positional audio, and websockets for signaling and game state.

Wevr requires a server for WebRTC signalling and to store game state: https://github.com/jayber/wevr-server

By default wevr uses the wevr-server hosted by VRLobby.co

www.vrlobby.co

##Important Omissions
Please be aware that at the moment
* Movement is restricted to a single plane on the vertical axis
* Not all features will work or have been tested on all available devices

##Features under consideration
1. Ability to override avatar and player elements
1. Add terrain tracking to movement, so users' location is automatically effected by ground elevation
1. Add teleportation to movement options
1. Ability to set wevr origin, so that player and avatars are spawned around that point in scene, rather than always 0,0,0
1. Complete device support
  1. Daydream?
  1. Movement for GearVR and mobile 2D
  1. Vive testing
1. Refactoring to support use as code library
1. Get avatars and/or avatar settings from user account on server

##Usage notes
* As soon as you give permission to the browser to use your microphone it's possible for someone else to be linked with you
and hear what you're saying / doing etc EVEN DURING LOCAL DEVELOPMENT. I will be adding server logic to prevent all `localhost` or `127.0.0.1` or other
 non public addresses from forming the same room, but be aware. At the moment there's nothing to prevent someone faking
 an origin address and listening in to an open browser tab.
* Currently Chrome will not allow pages from non-secure (i.e. non https) origins access to the microphone (except for local addresses).

Please email me at vrlobby.co@gmail.com with questions, comments, abuse, love notes etc :-D
var isMapReady = false;
var lastCompare

async function loadJSON(files){
  if (files.length <= 0) {
    return false;
  }
  
  console.debug("Attempting to load "+files[0].name);
  let domstr = await ReadFilePr(files.item(0));
  
  let result = JSON.parse(domstr);
  //---- FOR TESTING ----
  //var formatted = JSON.stringify(result, null, 2);
  //document.getElementById('result').innerHTML = formatted;
  //console.debug(result);
  //-- END FOR TESTING --
  return result;
}

function ReadFilePr(file){
  return new Promise((resolve, reject) => {
    var fr = new FileReader();  
    fr.onload = () => {
      resolve(fr.result)
    };
    fr.readAsText(file);
  });
}


async function compute(JSONPromise){
    let placeVisit = [];
    let locationData = await JSONPromise;
    for (i in locationData.timelineObjects){
      if (locationData.timelineObjects[i].hasOwnProperty('placeVisit')){
          placeVisit.push({
            latitude: locationData.timelineObjects[i].placeVisit.location.latitudeE7,
            longitude: locationData.timelineObjects[i].placeVisit.location.longitudeE7,
            startTime: Number(locationData.timelineObjects[i].placeVisit.duration.startTimestampMs),
            endTime: Number(locationData.timelineObjects[i].placeVisit.duration.endTimestampMs)
          });
      }
    }
    console.debug(placeVisit);
    //document.getElementById('result').innerHTML = JSON.stringify(placeVisit);
    
    return placeVisit;
}

async function SendtoDB(placeVisitPromise){
  let arrForPatient = await placeVisitPromise;
  let database = firebase.database();
  database.ref("patients/Counter").once("value").then(function(snapshot){
  for(entrynum=0; entrynum<arrForPatient.length; entrynum++){
    database.ref("patients/"+snapshot.val()+"/"+entrynum).set({
      "latitude":arrForPatient[entrynum].latitude,
      "longitude":arrForPatient[entrynum].longitude,
      "startTime":arrForPatient[entrynum].startTime,
      "endTime":arrForPatient[entrynum].endTime
    });
  }
  database.ref("patients/"+snapshot.val()).update({Counter:arrForPatient.length});
  database.ref("patients/Counter").set(snapshot.val()+1);

  });
}

async function SendEmail(address, subject, body){
  let headers = new Headers({'Content-Type': 'application/json', 'Authorization': 'Bearer '+SENDGRID_API_KEY})
  let req = new Request("https://api.sendgrid.com/v3/mail/send", {method: "POST", headers, body: '{"personalizations": [{"to": [{"email": "' + address + '"}]}],"from": {"email": "tohacks@seang.win"},"subject": "' + subject + '","content": [{"type": "text/plain", "value": "' + body + '"}]}'});
  fetch(req);
}

async function compare(placeVisitPromise){
  let placeVisit = await placeVisitPromise;
  let patientCounter = 0;
  let database = firebase.database();
  patientCounter = (await database.ref("patients/Counter").once("value")).val();
  
  console.debug(patientCounter);
  let commonLocations = []

  for(i=0;i<patientCounter;i++)
  {
    let patientJSON = (await database.ref("patients/"+i).once("value")).val();
      
    for(j= 0; j < patientJSON.Counter; j++)
    {
      //console.log(i + " " +j);
      for(k=0;k<placeVisit.length;k++)
      {
        let loc = placeVisit[k];
        let patientLoc = patientJSON[j];
        
        const bounds = 3000;
        const quarantineTime = 86400000;
        if((Math.abs(patientLoc.latitude - loc.latitude) <= bounds) && (Math.abs(patientLoc.longitude - loc.longitude) <= bounds))
        {
          if(Math.abs(patientLoc.endTime-loc.startTime) <= quarantineTime)
          {
            
            commonLocations.push({longitude: loc.longitude, latitude: loc.latitude, time: loc.startTime}); 
          }
          
        }
      }
    }
  }
  if(commonLocations.length == 0){
    document.getElementById('selectFiles').style.display = "none";
    document.getElementById('import').style.display = "none";
    document.getElementById('feedback').innerHTML = "You have not been in contact with COVID-19 patients.";
    document.getElementById('feedback').style.color = "green";
    
  }
  else
  {
    document.getElementById('import').style.display = "none";
    document.getElementById('selectFiles').style.display = "none";
    document.getElementById('feedback').innerHTML = "You have been in contact with COVID-19 patients "  + commonLocations.length + " times." + ' <a href="./about.html">Click Here To Learn The Next Steps</a>';
    document.getElementById('feedback').style.color = "red";
    document.getElementById('toMap').classList.remove("map-hidden");
    export2txt(commonLocations); 
  }

  lastCompare = commonLocations;
  return commonLocations;
}
async function getPatients()
{
  let database = firebase.database();
  let arr1 = (await database.ref("patients").once("value")).val();
  let arr2 = [];
  for(i =0 ; i < arr1.Counter; i++)
  {
    arr2.push(arr1[i]);
  }
  return arr2;
}
async function runDCP(placeVisit)
{
  let arr = (await getPatients());
  console.log(arr[0][0].latitude);
  compareDCP(placeVisit, arr);
}
async function compareDCP(placeVisit, patients){
  const { compute } = dcp;
  const resultsDiv = document.getElementById('results');
  var arr = patients;
    // Create Job
        let job = compute.for(arr,
        function(i, placeVisit) {
            progress(1);
            return "abc";
          }, placeVisit
        );

        // Listen for events
        job.on('status', console.log);
        job.on('result', ev => console.log(ev.sliceNumber + ":" + ev.result));
        // Send job to network
        job.exec(0.00001);
}
async function export2txt(arr) {
  const a = document.createElement("a");
  a.download = URL.createObjectURL(new Blob([JSON.stringify(arr, null, 2)], {
    type: "text/plain"
  }));
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
// non-functional pdf code
// function createPDF(){
//   var doc = new jsPDF();
//   // replace #ignorePDF with the id(s) of stuff you don't want to be printed to html
//   var elementHandler = {
//     '#createPDF': function (element, renderer) {
//       return true;
//     }
//   };
//   var source = window.document.getElementsByTagName("body")[0];
//   doc.fromHTML(
//       source,
//       15,
//       15,
//       {
//         'width': 180,'elementHandlers': elementHandler
//       });
//   doc.output("dataurlnewwindow");
// }

function initMap() {
  map = new google.maps.Map(document.getElementById('heatmap'), {
      center: {lat: 0, lng: 0},
      zoom: 8
  });
}

function mapReady() {
  isMapReady = true;
}

function geocodeLatLng(lat, lng) {
  var latlng = {lat: lat/10000000, lng: lng/10000000};
  var geocoder = new google.maps.Geocoder;
  return new Promise(function(resolve, reject) {
    geocoder.geocode({'location': latlng}, function(results, status) {
      console.log(status);
      if (status === 'OK') {
          console.log(results);
          resolve(results[0].formatted_address);
      } else {
          // reject(new Error('Couldnt\'t find the location ' + latlng));
          resolve('Couldnt\'t find the location ' + latlng.lat + " " + latlng.lng);
      }
    })
  })
}

async function plotCommonLocations(commonLocationsPromise){
  let commonLocations = await commonLocationsPromise;
  if(!commonLocations.length > 0 || !isMapReady) { return; }
  initMap();
  let elems = document.getElementsByClassName("map-hidden");
  Array.from(elems).forEach(function(element){ element.classList.remove("map-hidden") });
  commonLocations.forEach(function(location) {
    let encounterTime = new Date(location.time);
    let latlng = {lat: location.latitude/10000000, lng: location.longitude/10000000};
    // console.log(latlng.lat+ " " +latlng.lng);
    let marker = new google.maps.Marker({
      position: latlng,
      title: encounterTime.toLocaleDateString()
    });
    marker.setMap(map);
  });
  map.panTo({lat: commonLocations[0].latitude/10000000, lng: commonLocations[0].longitude/10000000});
  document.getElementById("heatmap").scrollIntoView({ 
    behavior: 'smooth'
  });
}

function thankYou(){
  document.getElementById("MainTxt").innerHTML="Submission successful!";
  document.getElementById("MainTxt").style.color="Green";
  document.getElementById("selectFiles").style.display = "none";
  document.getElementById("import").style.display="none"

}
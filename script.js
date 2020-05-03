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
  console.debug(result);
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
    document.getElementById('result').innerHTML = JSON.stringify(placeVisit);
    
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

async function compare(placeVisit){
  let patientCounter = 0;
  let database = firebase.database();
  patientCounter = (await database.ref("patients/Counter").once("value")).val();
  
  console.log(patientCounter);
  let commonLocations = []

  for(i=0;i<patientCounter;i++)
  {
    let patientJSON = (await database.ref("patients/"+i).once("value")).val();
      
    for(j= 0; j < patientJSON.Counter; j++)
    {
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
            commonLocations.push({latitude: loc.latitude, longitude: loc.longitude, time: loc.startTime}); 
          }
          
        }
      }
    }
  }
  document.getElementById("feedback").innerHTML = "New text!";
  return commonLocations;
}

async function compareDCP(placeVisit){
  const { compute } = dcp;

  let patientCounter = 0;
  let database = firebase.database();
  patientCounter = (await database.ref("patients/Counter").once("value")).val();
  
  console.log(patientCounter);
  
  // Create Job
  let job = compute.for(0, patientCounter,
    function(i) {
      progress(1);
      let commonLocations = [];
      let patientJSON = {}// (await database.ref("patients/"+i).once("value")).val();
      for(j= 0; j < patientJSON.Counter; j++)
      {
        for(k=0; k<placeVisit.length; k++)
        {
          let loc = placeVisit[k];
          let patientLoc = patientJSON[j];
          
          const bounds = 3000;
          const quarantineTime = 86400000;
          if((Math.abs(patientLoc.latitude - loc.latitude) <= bounds) && (Math.abs(patientLoc.longitude - loc.longitude) <= bounds))
          {
            if(Math.abs(patientLoc.endTime-loc.startTime) <= quarantineTime)
            {
              commonLocations.push({latitude: loc.latitude, longitude: loc.longitude, time: loc.startTime}); 
            }
            
          }
        }
      }
    }
  )

  // Listen for events
  job.on("status", console.log);

  // Send job to network
  job.exec(0.00001).then(console.log);

  // Work on network
  compute.work(4, "0x840d8Ae05dBD5f9243CE56E43BCbD8626106e353");
}


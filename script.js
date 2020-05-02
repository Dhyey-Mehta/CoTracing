async function loadJSON(files){
  if (files.length <= 0) {
    return false;
  }
  
  console.debug("Attempting to load "+files[0].name);
  domstr = await ReadFilePr(files.item(0));
  
  var result = JSON.parse(domstr);
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
          let latitude = locationData.timelineObjects[i].placeVisit.location.latitudeE7;
          let longitude = locationData.timelineObjects[i].placeVisit.location.longitudeE7;
          let startTime = locationData.timelineObjects[i].placeVisit.duration.startTimestampMs;
          let endTime = locationData.timelineObjects[i].placeVisit.duration.endTimestampMs;

          placeVisit.push({latitude:latitude,longitude:longitude,startTime:startTime,endTime:endTime});
      }
    }
    console.debug(placeVisit);
    document.getElementById('result').innerHTML = JSON.stringify(placeVisit);
    
    return placeVisit;
}


let placeVisit = compute();
let patient = [{latitude:438250504, longitude:-793731613, startTime:1585789139637, endTime:1586380498044}];
let commonLocations = []

for(i in patient)
{
  for(j in placeVisit)
  {
    const bounds = 3000;
    const quarintineTime = 86400000;
    if((Math.abs(i.latitude - j.latitude) <= bounds) && (Math.abs(i.longitude - j.longitude) <= bounds)){
      if(Math.abs(i.endTime-j.startTime)<8640000)
      {
        commonLocations[commonLocations.length] = {latitude: j.latitude, longitude: j.longitude, time: j.startTime}
      }
      
    }
  }
}

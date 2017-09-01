import cityRankLoad from '../src/city-rank-load'


export default function (cityId,cb) {

  cityRankLoad(function (data) {
    data.forEach(function (d) {
      if(d.id == cityId){
        cb(d)
        // curZL.html("空气质量：" + data[i].quality);
        // curAQi.html("AQI：" + data[i].aqi);
        // curPM.html("PM2.5：" + data[i].pm2_5);
        // curPM10.html("PM10：" + data[i].pm10);
        // curCO.html("CO：" + data[i].co);
        // curNO2.html("NO2：" + data[i].no2);
        // curO3.html("O3：" + data[i].o3);
      }
    })
  })
}

import {cSite} from './wtData_v2'
export default function (cityName) {

  return cSite.dirCity.city[cityName.replace(/市$/, '')]
}

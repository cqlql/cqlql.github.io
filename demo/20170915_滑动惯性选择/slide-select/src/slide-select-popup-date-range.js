import '../slide-select.css'
import SlideSelect from './slide-select-popup'
import DateRange from './date-range-data'

let slideSelect = new SlideSelect()
slideSelect.init()
slideSelect.use(new DateRange())

slideSelect.onChange = function () {
  console.log(this.dataHandle.result)
}

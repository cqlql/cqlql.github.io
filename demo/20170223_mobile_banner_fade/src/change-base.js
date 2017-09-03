
export default class {
  constructor({count}){
    this.index = 0
    this.count=count
  }
  goRight(ex){
    let {index,count} = this

    let currIndex =index+1

    if(currIndex>=count){
      currIndex = 0
    }

    this.index = currIndex

    ex(index,currIndex)
  }
  goLeft(ex){
    let {index,count} = this

    let currIndex = this.index=index-1

    if(currIndex<0){
      currIndex = count-1
    }

    this.index = currIndex

    ex(index,currIndex)
  }
}

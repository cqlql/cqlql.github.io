
与 set 的区别：init 只能用对象初始化器初始化，而set都可以。

```cs

class Person_InitExample
{
     private int _yearOfBirth;

     public int YearOfBirth
     {
         get { return _yearOfBirth; }
         init { _yearOfBirth = value; }
     }
}

var john = new Person_InitExample
{
    YearOfBirth = 1984
};

john.YearOfBirth = 1926; //Not allowed, as its value can only be set once in the constructor
```

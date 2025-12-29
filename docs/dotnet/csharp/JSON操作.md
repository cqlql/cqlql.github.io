
## 对象转 json

```cs
public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
}

Person person = new Person { Name = "John", Age = 30 };
string json = JsonConvert.SerializeObject(person);
```

## 数组转json

## 集合转json

```cs
List<Student> students = new List<Student>
{
    new Student { Name = "Alice", Age = 20, Gender = "Female" },
    new Student { Name = "Bob", Age = 21, Gender = "Male" },
    new Student { Name = "Charlie", Age = 22, Gender = "Male" }
};
string json = JsonConvert.SerializeObject(students);
```

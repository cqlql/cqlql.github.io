使用 GitPython 库

参考文档

https://gitpython.readthedocs.io/en/stable/tutorial.html

https://www.cnblogs.com/wanglan/p/10718876.html

https://www.jianshu.com/p/c1a7a32ae50b

```py
import git


def commit():
    repo = git.Repo('./.git')

    if repo.is_dirty():
        repo.remote().fetch()
        # try:
        #   repo.remote().pull()
        # except:
        #     print('pull错误')

        repo.git.add('-A')

        # repo.index.add(['*'])
        # repo.index.remove(['*'])

        # repo.index.commit(f"update {datetime.datetime.now()}")
        repo.index.commit('.')

        repo.remote().push()

        print('push 完成')


commit()

```

Kubernetes 被称为“云操作系统”



pop 推荐只放一个主进程+多个辅助进程。也就是一个微服务。



工作节点(Worker Node)：物理机器或者虚拟机，一个工作节点对应一台机器：

- **集群：** 是由**多台机器**组成的整体。它可以包含 2 台、10 台甚至上千台机器。
- **节点：** 是集群里的**单台机器**。



如何区分pop，通过Labels+Selectors

| **维度**            | **例子**                       | **作用**                                   |
| ------------------- | ------------------------------ | ------------------------------------------ |
| **Namespace**       | `prod-env`                     | 区分不同的运行环境（生产 vs 开发）         |
| **App Label**       | `app: mall-system`             | **区分大应用**（比如整个商城系统）         |
| **Component Label** | `tier: frontend` 或 `role: db` | **区分应用内的组件**（前端、后端、数据库） |
| **Version Label**   | `version: v1.2`                | 区分同一个微服务的不同版本                 |



分布式事务/锁（数据库）：解决多副本同时修改同一行数据



## 数据库的高可用、可移植、易管理

现阶段推荐 **Operator + Longhorn**，应为够简单，等到一定规模，也许需要 **Operator + Ceph**。

**Operator + 云硬盘**最省心，但是要钱。

为什么大家都不选 **Operator + 本地存储**，因为在生产环境中，**“数据重平衡（Rebalance）”**是一个巨大的风险点。

想象一下：如果你有 2TB 数据。

- **用本地存储**：坏一台机器，新 Pod 要同步 2TB 数据，可能需要几个小时甚至一天，期间网络带宽会被占满，影响业务。
- **用 Longhorn**：坏一台机器，新 Pod 挂载旧硬盘，几秒钟就恢复了。

### Operator 选择

以下是目前社区公认、经过大规模生产验证的优秀选择：

#### **PostgreSQL**

- **CloudNativePG (CNPG):** 目前最推荐。它不依赖外部工具（如 Patroni），而是利用 K8s 原生功能实现高可用，极其轻量且现代化。
- **Zalando Postgres Operator:** 历史悠久，功能极其丰富，经受过 Zalando 公司数千个数据库实例的考验。

#### **MySQL**

- **MySQL Operator for InnoDB Cluster:** Oracle 官方出品，如果你追求“原厂血统”，这是首选。
- **TiDB Operator:** 虽然是分布式数据库，但其 Operator 的设计非常精妙，是处理有状态应用的教科书。
- **Presslabs MySQL Operator:** 比较成熟的社区方案。

#### **Redis**

- **Redis Operator (by OT-CONTAINER):** 支持 Sentinel、Cluster 等各种模式，社区活跃度较高。
- **Spotahome Redis Operator:** 另一个流行的轻量级选择。


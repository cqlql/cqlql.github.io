---
title: Kubernetes 介绍
icon: devicon:kubernetes
sort: 1
---

Kubernetes 被称为"云操作系统"。

## 容器网络插件

常见的 CNI 网络插件：

- Flannel
- Calico
- Cilium
- Canal
- Multus（多网络）

## K8s 管理面板

- **Kubernetes Dashboard**：简单、轻量、上手快，适合个人项目 / 小团队 / 学习 / 开发环境。
- **Rancher**：适合企业 / 多集群 / 多团队 / 有权限要求的场景，能大幅提升可管理性与扩展性。

> 实际部署时也不必完全抛弃 Dashboard：即使用了 Rancher，原生 Dashboard 通常还是可以作为快速查看 / 调试工具保留。

## 相关工具

- [Kubernetes IDE - Lens](https://k8slens.dev/)：图形化 K8s 管理工具。

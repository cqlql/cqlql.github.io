---
title: 镜像标准 Docker/OCI
---

Docker 镜像是历史事实标准，而 **OCI 镜像是更开放、更轻量的未来**：

- **OCI 镜像是标准**，Docker 镜像是实现（并兼容标准）。
- 现代 Docker 已拥抱 OCI，两者差异逐渐缩小，但 OCI 更开放、跨平台。
- 选择取决于工具链需求：Docker 生态用 Docker 镜像，云原生/开放标准用 OCI 镜像。
- **生产部署**：转换为 OCI 镜像（兼容性更好，避免厂商锁定）。
- 使用 `buildah`/`skopeo` 等支持双格式的工具。
- [Docker Hub](https://hub.docker.com/) 存储的是 Docker 格式镜像，但**内容完全兼容 OCI**，所有 OCI 工具均可直接使用。

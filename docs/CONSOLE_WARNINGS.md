# 콘솔 경고 안내

## `[DEPRECATED] Instrument... Default export is deprecated. Instead use 'import { create } from 'zustand'`

- **원인**: 이 프로젝트에서는 **zustand**를 사용하지 않습니다. 해당 메시지는 **Vercel 배포 시 자동으로 삽입되는 스크립트**(Speed Insights, Agent 등)가 내부적으로 zustand를 사용할 때 발생하는 deprecation 경고입니다.
- **조치**: 앱 동작에는 영향이 없으며, **무시해도 됩니다**. 제거하려면 Vercel 대시보드에서 해당 기능(Speed Insights 등)을 비활성화할 수 있습니다.

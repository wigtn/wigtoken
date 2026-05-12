import meta from "../../../pages/_meta.ts";
import ja_meta from "../../../pages/ja/_meta.ts";
import ko_meta from "../../../pages/ko/_meta.ts";
import zh_meta from "../../../pages/zh/_meta.ts";
export const pageMap = [{
  data: meta
}, {
  name: "agent",
  route: "/agent",
  frontMatter: {
    "title": "Agent"
  }
}, {
  name: "api-reference",
  route: "/api-reference",
  frontMatter: {
    "title": "API reference"
  }
}, {
  name: "comparison",
  route: "/comparison",
  frontMatter: {
    "title": "vs ccusage / CodeBurn"
  }
}, {
  name: "deploy",
  route: "/deploy",
  frontMatter: {
    "title": "Deployment"
  }
}, {
  name: "hooks",
  route: "/hooks",
  frontMatter: {
    "title": "Claude Code hooks"
  }
}, {
  name: "index",
  route: "/",
  frontMatter: {
    "title": "Introduction"
  }
}, {
  name: "ja",
  route: "/ja",
  children: [{
    data: ja_meta
  }, {
    name: "index",
    route: "/ja",
    frontMatter: {
      "title": "概要"
    }
  }]
}, {
  name: "ko",
  route: "/ko",
  children: [{
    data: ko_meta
  }, {
    name: "agent",
    route: "/ko/agent",
    frontMatter: {
      "title": "에이전트"
    }
  }, {
    name: "api-reference",
    route: "/ko/api-reference",
    frontMatter: {
      "title": "API 레퍼런스"
    }
  }, {
    name: "comparison",
    route: "/ko/comparison",
    frontMatter: {
      "title": "ccusage / CodeBurn 비교"
    }
  }, {
    name: "deploy",
    route: "/ko/deploy",
    frontMatter: {
      "title": "배포"
    }
  }, {
    name: "hooks",
    route: "/ko/hooks",
    frontMatter: {
      "title": "Claude Code 훅"
    }
  }, {
    name: "index",
    route: "/ko",
    frontMatter: {
      "title": "소개"
    }
  }, {
    name: "quickstart",
    route: "/ko/quickstart",
    frontMatter: {
      "title": "빠른 시작"
    }
  }, {
    name: "self-host",
    route: "/ko/self-host",
    frontMatter: {
      "title": "셀프 호스팅"
    }
  }, {
    name: "widget",
    route: "/ko/widget",
    frontMatter: {
      "title": "위젯"
    }
  }]
}, {
  name: "quickstart",
  route: "/quickstart",
  frontMatter: {
    "title": "Quickstart"
  }
}, {
  name: "self-host",
  route: "/self-host",
  frontMatter: {
    "title": "Self-hosting"
  }
}, {
  name: "widget",
  route: "/widget",
  frontMatter: {
    "title": "Widget"
  }
}, {
  name: "zh",
  route: "/zh",
  children: [{
    data: zh_meta
  }, {
    name: "index",
    route: "/zh",
    frontMatter: {
      "title": "简介"
    }
  }]
}];
import meta from "../../../pages/_meta.ts";
import ko_meta from "../../../pages/ko/_meta.ts";
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
  name: "ko",
  route: "/ko",
  children: [{
    data: ko_meta
  }, {
    name: "deploy",
    route: "/ko/deploy",
    frontMatter: {
      "title": "배포"
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
}];
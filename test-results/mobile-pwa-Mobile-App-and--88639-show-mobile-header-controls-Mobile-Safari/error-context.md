# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2]:
    - /url: "#main-content"
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "Something went wrong" [level=2] [ref=e9]
    - paragraph [ref=e10]: We're sorry, but something unexpected happened. Please try refreshing the page.
    - generic [ref=e11]:
      - button "Refresh Page" [ref=e12] [cursor=pointer]
      - button "Try Again" [ref=e13] [cursor=pointer]
    - group [ref=e14]:
      - generic "Error Details (Development)" [ref=e15] [cursor=pointer]
```
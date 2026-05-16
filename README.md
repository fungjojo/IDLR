# IDLR

stop all services

```
    pkill -f "ts-node src/index" ; pkill -f "vite" ; pkill -f "concurrently" ; brew services stop mongodb/brew/mongodb-community
```

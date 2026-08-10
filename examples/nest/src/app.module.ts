import { Controller, Get, Module } from "@nestjs/common";
import { consoleNotifier } from "@futurewindai/wotchi";
import { WotchiModule } from "@futurewindai/wotchi/nest";

@Controller()
class ExampleController {
  private repeatCount = 0;

  @Get("success")
  success() {
    return { status: "ok", framework: "nestjs", version: "11.x" };
  }

  @Get("error")
  error() {
    throw new Error("NestJS example error");
  }

  @Get("repeat-error")
  repeatError() {
    this.repeatCount += 1;
    throw new Error(`NestJS example repeated error #${this.repeatCount}`);
  }

  @Get("secret-error")
  secretError() {
    throw new Error("NestJS example secret token=example-only-secret");
  }

  @Get("spike")
  spike() {
    return { status: "ok", message: "NestJS example is ready" };
  }
}

@Module({
  imports: [
    WotchiModule.forRoot({
      service: "wotchi-nest-example",
      environment: "local-example",
      notifiers: [consoleNotifier()],
    }),
  ],
  controllers: [ExampleController],
})
export class AppModule {}

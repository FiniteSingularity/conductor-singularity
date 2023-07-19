import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/routes";
import { CountdownConfig, CountdownGlobalConfig } from "ngx-countdown";

export function countdownConfigFactory(): CountdownConfig {
  return {};
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: CountdownGlobalConfig, useFactory: countdownConfigFactory },
  ],
}).catch((err) => console.error(err));

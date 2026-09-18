import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((result) => {
        // Jika response sudah terformat atau berupa file stream, jangan diubah
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }

        let message = 'Operasi berhasil dilakukan';
        let data = result;

        if (result && typeof result === 'object' && !Array.isArray(result) && 'data' in result) {
          message = (result as any).message || 'Operasi berhasil dilakukan';
          data = (result as any).data;
          const otherProps: any = {};
          for (const key of Object.keys(result)) {
            if (key !== 'message' && key !== 'data') {
              otherProps[key] = (result as any)[key];
            }
          }
          return {
            success: true,
            message,
            data,
            ...otherProps,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          message,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

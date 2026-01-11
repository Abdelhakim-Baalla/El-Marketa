import { IsString, IsNotEmpty, IsNumber, Min, IsEnum } from 'class-validator';

export enum StockOperation {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

export class UpdateStockDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsEnum(StockOperation)
  operation: StockOperation;
}


'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';

interface MonthlyRevenueChartProps {
  data: { month: string; revenue: number }[];
}

const chartConfig = {
  revenue: {
    label: 'Recaudo',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export default function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-4">No hay datos de recaudo mensual para mostrar.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full aspect-video">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value).replace('COP', '').trim()} // Remove COP for cleaner axis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            width={80}
          />
          <RechartsTooltip
            cursor={false}
            content={<ChartTooltipContent 
                formatter={(value, name, props) => (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{props.payload.month}</span>
                        <span className="text-muted-foreground">Recaudo: {formatCurrency(Number(value))}</span>
                    </div>
                )}
            />}
          />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

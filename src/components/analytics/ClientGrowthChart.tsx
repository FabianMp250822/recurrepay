
'use client';

import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';

interface ClientGrowthChartProps {
  data: { month: string; count: number }[];
}

const chartConfig = {
  count: {
    label: 'Nuevos Clientes',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export default function ClientGrowthChart({ data }: ClientGrowthChartProps) {
   if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-4">No hay datos de crecimiento de clientes para mostrar.</p>;
  }
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full aspect-video">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false}/>
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          <YAxis 
            allowDecimals={false} 
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          <RechartsTooltip
            cursor={false}
            content={<ChartTooltipContent 
                 formatter={(value, name, props) => (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{props.payload.month}</span>
                        <span className="text-muted-foreground">Nuevos Clientes: {value}</span>
                    </div>
                )}
            />}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            strokeWidth={2}
            dot={{
              fill: 'var(--color-count)',
              r: 4,
            }}
            activeDot={{
              r: 6,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

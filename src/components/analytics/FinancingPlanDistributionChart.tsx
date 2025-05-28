
'use client';

import { Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
  ChartConfig
} from '@/components/ui/chart';

interface FinancingPlanDistributionChartProps {
  data: { name: string; value: number; fill: string }[];
}

export default function FinancingPlanDistributionChart({ data }: FinancingPlanDistributionChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-4">No hay datos de distribución de planes para mostrar.</p>;
  }

  // Dynamically create chartConfig from data for legend
  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.fill };
    return acc;
  }, {} as ChartConfig);


  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <RechartsTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="name" />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={60}
            labelLine={false}
            // label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
            //   const RADIAN = Math.PI / 180;
            //   const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            //   const x = cx + radius * Math.cos(-midAngle * RADIAN);
            //   const y = cy + radius * Math.sin(-midAngle * RADIAN);
            //   return (
            //     <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
            //       {`${name} (${(percent * 100).toFixed(0)}%)`}
            //     </text>
            //   );
            // }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
           <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

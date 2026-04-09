"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SeriesPoint = {
  date: string;
  value: number;
};

type OverviewChartsProps = {
  emailsByDay: SeriesPoint[];
  otpsByDay: SeriesPoint[];
  ordersByDay: SeriesPoint[];
};

export function OverviewCharts({ emailsByDay, otpsByDay, ordersByDay }: OverviewChartsProps) {
  const emailData = emailsByDay.map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));
  const otpData = otpsByDay.map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));
  const orderData = ordersByDay.map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="rounded-[28px] bg-card/88 xl:col-span-2">
        <CardHeader>
          <CardTitle>Lượng email theo ngày</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={emailData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] bg-card/88">
        <CardHeader>
          <CardTitle>Số OTP tìm được theo ngày</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={otpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] bg-card/88 xl:col-span-3">
        <CardHeader>
          <CardTitle>Email đơn hàng theo ngày</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--color-chart-4)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

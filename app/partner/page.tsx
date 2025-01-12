"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PartnerDashboard() {
  const [tracking, setTracking] = useState([]);
  const [stats, setStats] = useState({
    visits: 0,
    ticketsSelected: 0,
    flightsSelected: 0,
    hotelsSelected: 0,
    confirmed: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const fetchTrackingData = async () => {
    const res = await fetch("/api/affiliate/stats");
    const data = await res.json();
    setTracking(data.tracking);
    setStats(data.stats);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Partner Dashboard</h1>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">Total Visits</h3>
          <p className="text-2xl">{stats.visits}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">Confirmed Bookings</h3>
          <p className="text-2xl">{stats.confirmed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">Total Revenue</h3>
          <p className="text-2xl">${stats.totalRevenue}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {tracking.map((track: {
            id: string | number;
            timestamp: string;
            stage: string;
            data: string;
            }) => (
            <TableRow key={track.id}>
              <TableCell>
              {new Date(track.timestamp).toLocaleDateString()}
              </TableCell>
              <TableCell>{track.stage}</TableCell>
              <TableCell>
                <pre className="text-sm">
                  {JSON.stringify(track.data, null, 2)}
                </pre>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
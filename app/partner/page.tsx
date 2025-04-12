"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../hooks/AuthContext";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PartnerDashboard() {
  const { isAuthenticated, affiliateId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState([]);
  const [stats, setStats] = useState({
    visits: 0,
    ticketsSelected: 0,
    flightsSelected: 0,
    hotelsSelected: 0,
    confirmed: 0,
    totalRevenue: 0,
    commission: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/partner/login");
      return;
    }
    fetchTrackingData();
  }, [isAuthenticated, router]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/affiliate/stats?affiliateId=${affiliateId}`
      );
      const data = await res.json();
      setTracking(data.trackingData);
      setStats(data.stats);
    } catch (error) {
      console.error("Failed to fetch tracking data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">
        Hello {affiliateId}!, Welcome to your Partner Dashboard
      </h1>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Overview Stats</h2>
        <p className="text-gray-600">
          Quick summary of your partnership performance
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">Total Unique Visitors</h3>
          <p className="text-2xl">{stats?.visits}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">Confirmed Bookings (num of tickets)</h3>
          <p className="text-2xl">{stats?.confirmed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">
            Total Commission (by €{stats.commission})
          </h3>
          <p className="text-2xl">€{stats?.totalRevenue}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold">Detailed Activity Log</h2>
        <p className="text-gray-600">
          A timeline of the last 1000 client interactions through your affiliate
          code
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Date</TableHead>
            <TableHead className="text-left">Stage</TableHead>
            <TableHead className="text-left">User ID</TableHead>
            <TableHead className="text-left">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tracking.map(
            (track: {
              id: string | number;
              timestamp: string;
              stage: string;
              data: string;
              user_id: string;
            }) => (
              <TableRow
                key={track.id}
                className={track.stage === "CONFIRMED" ? "bg-green-100" : ""}
              >
                <TableCell>
                  {new Date(track.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      track.stage === "CONFIRMED"
                        ? "font-semibold text-green-700"
                        : ""
                    }
                  >
                    {track.stage.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell>{track.user_id}</TableCell>
                <TableCell>
                  <pre className="text-sm">
                    {JSON.stringify(track.data, null, 2)}
                  </pre>
                </TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}

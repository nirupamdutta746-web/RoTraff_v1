import React from "react";
import { TracingBeam } from "./TracingBeam";
import {
  AlertTriangle,
  Shield,
  MapPin,
  Route,
  Users,
  BarChart3,
} from "lucide-react";

const storyContent = [
  {
    badge: "How It Works",
    title: "Report hazards in seconds",
    description: (
      <>
        <p>
          Open the map, tap a location, and select the incident type — pothole,
          landslide, accident, flood, construction, or debris. Rate severity
          from low to critical and add optional details. Your report goes live
          instantly, helping every driver nearby steer clear of danger.
        </p>
        <p>
          Each report is geo-tagged with precise coordinates so the community
          sees exactly where the hazard sits. A single tap alerts thousands of
          drivers on their planned routes.
        </p>
      </>
    ),
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    badge: "Community Trust",
    title: "Verified by real drivers",
    description: (
      <>
        <p>
          Every incident can be confirmed or disputed by other drivers passing
          through. The more confirmations a report receives, the higher its
          trust score climbs — making it a reliable signal for everyone.
        </p>
        <p>
          When a hazard is resolved, drivers mark it as such and the map updates
          in real time. No stale data, no false alarms — just a living,
          breathing road condition network maintained by the people who drive it.
        </p>
      </>
    ),
    icon: <Users className="w-5 h-5" />,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    badge: "Risk Scoring",
    title: "Routes ranked by safety, not just speed",
    description: (
      <>
        <p>
          SafeRoad calculates a real-time risk score for every route option by
          analyzing incident density, severity levels, and road conditions
          along the path. You get three route choices — fastest, balanced, and
          safest — each with a clear risk percentage.
        </p>
        <p>
          Choose the route that matches your comfort level. A family road trip?
          Pick the safest path. Running late for a meeting? The fastest option
          still shows you what risks lie ahead so you can drive accordingly.
        </p>
      </>
    ),
    icon: <Shield className="w-5 h-5" />,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    badge: "Live Navigation",
    title: "Turn-by-turn with incident awareness",
    description: (
      <>
        <p>
          As you drive, the map continuously monitors new reports along your
          route. If a new hazard pops up ahead, SafeRoad recalculates and
          suggests an alternate path — before you reach the danger zone.
        </p>
        <p>
          Travel time estimates factor in not just distance but actual road
          conditions: construction delays, accident congestion, flood-affected
          streets, and icy patches. The ETA you see is the one you will get.
        </p>
      </>
    ),
    icon: <Route className="w-5 h-5" />,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    badge: "Driver Analytics",
    title: "Your driving footprint, decoded",
    description: (
      <>
        <p>
          Track every route you have planned, every incident you have reported,
          and the cumulative risk you have helped reduce. Your profile builds a
          complete picture of your contribution to road safety.
        </p>
        <p>
          See how many drivers benefited from your reports, view your average
          route risk score over time, and discover patterns in your driving
          habits. Data that makes you a more informed and safer driver.
        </p>
      </>
    ),
    icon: <BarChart3 className="w-5 h-5" />,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
];

export default function TracingBeamDemo() {
  return (
    <TracingBeam className="px-6">
      <div className="max-w-2xl mx-auto antialiased pt-4 relative">
        {storyContent.map((item, index) => (
          <div key={`story-${index}`} className="mb-14">
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}
              >
                <span className={item.color}>{item.icon}</span>
              </div>
              <h2 className="glass-strong rounded-full text-sm font-semibold w-fit px-4 py-1.5 text-foreground">
                {item.badge}
              </h2>
            </div>

            <p className="text-xl font-bold mb-4 text-foreground">
              {item.title}
            </p>

            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              {item.description}
            </div>
          </div>
        ))}
      </div>
    </TracingBeam>
  );
}

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(supabaseUrl, anonKey);

async function testBreakTelemetryFlow() {
  console.log('Testing Supabase Break Telemetry & State Continuation Flow...');

  const employeeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const employeeName = 'Arsal';
  const startedAt = new Date().toISOString();
  const timestamp = Date.now();
  const breakType = 'coffee';
  const filePath = `telemetry_snapshots/${employeeId}/${timestamp}_${breakType}.json`;

  const snapshotPayload = {
    id: `snap-${timestamp}`,
    employee_id: employeeId,
    employee_name: employeeName,
    break_type: breakType,
    break_title: 'Coffee Break (11:00 – 11:30 AM)',
    started_at: startedAt,
    current_time_slot: '11:00',
    time_slot_index: 2,
    hourly_state: {
      time_slot: '11:00',
      slot_index: 2,
      pre_break_keys: 1520,
      pre_break_heatmap_pct: 46.5,
    },
    status: 'active_break',
  };

  // 1. Upload to Supabase Storage Bucket ('screenshots')
  console.log('1. Uploading snapshot to Supabase bucket "screenshots"...');
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('screenshots')
    .upload(filePath, Buffer.from(JSON.stringify(snapshotPayload, null, 2)), {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Bucket upload failed:', uploadErr);
  } else {
    console.log('Bucket upload SUCCESS:', uploadData.path);
  }

  // 2. Insert record into public.activity_events table
  console.log('2. Inserting BREAK_TELEMETRY_SNAPSHOT into activity_events...');
  const { data: eventData, error: eventErr } = await supabase
    .from('activity_events')
    .insert([
      {
        employee_id: employeeId,
        device_id: 'WIN-DESKTOP-QUVQI4B-ok',
        event_type: 'BREAK_TELEMETRY_SNAPSHOT',
        occurred_at: startedAt,
        metadata: {
          ...snapshotPayload,
          storage_path: filePath,
          bucket: 'screenshots',
        },
      },
    ])
    .select();

  if (eventErr) {
    console.error('activity_events insert failed:', eventErr);
  } else {
    console.log('activity_events insert SUCCESS, row id:', eventData[0]?.id);
  }

  // 3. Resumption: Continue from last state with adjusted progression
  console.log('3. Testing Break Resumption & Hourly Continuation...');
  const preBreakKeys = snapshotPayload.hourly_state.pre_break_keys;
  const preBreakHeatmap = snapshotPayload.hourly_state.pre_break_heatmap_pct;
  const postBreakKeys = 1516;
  const postBreakHeatmap = 42.8;
  const adjustedTotalKeys = preBreakKeys + postBreakKeys; // 1520 + 1516 = 3036
  const adjustedHeatmap = Math.min(100, Number((preBreakHeatmap + postBreakHeatmap).toFixed(1))); // 89.3%

  const resumedPayload = {
    snapshot_id: snapshotPayload.id,
    employee_name: employeeName,
    break_type: breakType,
    break_duration_seconds: 1800,
    resumed_at: new Date().toISOString(),
    current_time_slot: '11:00',
    time_slot_index: 2,
    resumed_state: {
      time_slot: '11:00',
      slot_index: 2,
      pre_break_keys: preBreakKeys,
      pre_break_heatmap_pct: preBreakHeatmap,
      post_break_keys: postBreakKeys,
      post_break_heatmap_pct: postBreakHeatmap,
      adjusted_total_keys: adjustedTotalKeys,
      adjusted_heatmap_pct: adjustedHeatmap,
      hourly_delta_pct: +(adjustedHeatmap - preBreakHeatmap).toFixed(1),
    },
    status: 'resumed',
  };

  const { data: resumeData, error: resumeErr } = await supabase
    .from('activity_events')
    .insert([
      {
        employee_id: employeeId,
        device_id: 'WIN-DESKTOP-QUVQI4B-ok',
        event_type: 'BREAK_TELEMETRY_RESUMED',
        occurred_at: new Date().toISOString(),
        metadata: resumedPayload,
      },
    ])
    .select();

  if (resumeErr) {
    console.error('BREAK_TELEMETRY_RESUMED insert failed:', resumeErr);
  } else {
    console.log('BREAK_TELEMETRY_RESUMED insert SUCCESS, row id:', resumeData[0]?.id);
    console.log('Adjusted Hourly Progress verified:', {
      pre_break: `${preBreakKeys} keys / ${preBreakHeatmap}% intensity`,
      resumed_addition: `+${postBreakKeys} keys / +${postBreakHeatmap}% intensity`,
      final_hourly_total: `${adjustedTotalKeys} keys / ${adjustedHeatmap}% intensity`,
    });
  }
}

testBreakTelemetryFlow().catch(console.error);

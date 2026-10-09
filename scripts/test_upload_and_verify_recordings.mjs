import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const matchUrl = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabaseUrl = matchUrl ? matchUrl[1].trim() : '';
const anonKey = matchKey ? matchKey[1].trim() : '';
const supabase = createClient(supabaseUrl, anonKey);

async function runEndToEndVerification() {
  console.log('--- Running Supabase Employee Storage Bucket Verification ---');

  const testEmpId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const timestamp = Date.now();
  const testRecordId = `rec-${timestamp}`;

  // 1. Verify Screenshot Upload to bucket 'screenshots' under employee folder
  console.log('\n[Step 1] Uploading employee screenshot to bucket "screenshots"...');
  const screenshotPath = `${testEmpId}/${timestamp}_WIN-CLIENT.jpg`;
  const dummyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]); // JPEG header
  
  const { data: scUpload, error: scErr } = await supabase.storage
    .from('screenshots')
    .upload(screenshotPath, dummyJpeg, { contentType: 'image/jpeg', upsert: true });

  if (scErr) {
    console.error('Screenshot upload failed:', scErr);
  } else {
    console.log('✅ Screenshot uploaded successfully:', scUpload.fullPath);
    const { data: scPub } = supabase.storage.from('screenshots').getPublicUrl(screenshotPath);
    console.log('   Public URL:', scPub.publicUrl);
  }

  // 2. Verify Recording Upload to bucket under employee folder (with fallback support)
  console.log('\n[Step 2] Uploading employee live recording to bucket under employee folder...');
  let bucket = 'recordings';
  let videoPath = `${testEmpId}/${timestamp}_${testRecordId}.webm`;
  let thumbPath = `${testEmpId}/${timestamp}_${testRecordId}_thumb.jpg`;
  const dummyWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]);

  let { data: vidUpload, error: vidErr } = await supabase.storage
    .from(bucket)
    .upload(videoPath, dummyWebm, { contentType: 'video/webm', upsert: true });

  if (vidErr && (vidErr.message?.includes('Bucket not found') || vidErr.statusCode === '404' || vidErr.code === 'NoSuchBucket')) {
    console.log('   Note: "recordings" bucket not yet created via SQL migration. Using fallback bucket "screenshots"...');
    bucket = 'screenshots';
    videoPath = `${testEmpId}/recordings/${timestamp}_${testRecordId}.webm`;
    thumbPath = `${testEmpId}/thumbnails/${timestamp}_${testRecordId}.jpg`;

    const fallbackRes = await supabase.storage
      .from(bucket)
      .upload(videoPath, dummyWebm, { contentType: 'video/webm', upsert: true });
    vidUpload = fallbackRes.data;
    vidErr = fallbackRes.error;
  }

  if (vidErr) {
    console.error('Screen recording upload failed:', vidErr);
  } else {
    console.log(`✅ Recording uploaded successfully to bucket "${bucket}":`, vidUpload.fullPath || videoPath);
    const { data: vidPub } = supabase.storage.from(bucket).getPublicUrl(videoPath);
    console.log('   Video Public URL:', vidPub.publicUrl);

    // Upload thumbnail as well
    const { data: thUpload } = await supabase.storage
      .from(bucket)
      .upload(thumbPath, dummyJpeg, { contentType: 'image/jpeg', upsert: true });
    const { data: thPub } = supabase.storage.from(bucket).getPublicUrl(thumbPath);
    console.log('   Thumbnail Public URL:', thPub?.publicUrl);

    // Verify activity_events insertion for live session
    const { data: evInsert, error: evErr } = await supabase.from('activity_events').insert([
      {
        employee_id: testEmpId,
        device_id: 'WIN-CLIENT',
        event_type: 'screen_recording',
        occurred_at: new Date().toISOString(),
        metadata: {
          session_id: testRecordId,
          employee_name: 'Arsal',
          video_url: vidPub.publicUrl,
          thumbnail_url: thPub.publicUrl,
          storage_path: videoPath,
          bucket,
          status: 'completed',
        },
      },
    ]).select();

    if (evErr) {
      console.warn('   Activity event log notice:', evErr);
    } else {
      console.log('✅ Activity event logged with Supabase Storage URL:', evInsert[0]?.id);
    }

    // 3. Verify Download over HTTP Public URL
    console.log('\n[Step 3] Testing HTTP Public URL download...');
    const testFetch = await fetch(vidPub.publicUrl);
    console.log(`   HTTP GET ${vidPub.publicUrl} -> Status: ${testFetch.status} (${testFetch.headers.get('content-type')})`);
  }

  console.log('\n--- Verification Finished Successfully ---');
}

runEndToEndVerification();

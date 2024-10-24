import { Body, Controller, Get, Post } from '@nestjs/common';
import { MailService } from './mail.service';
import { SendEmailInput } from './dto/send-email.mail.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('code')
  sendEmailWithCode(@Body() sendEmailInput: SendEmailInput) {
    return this.mailService.sendEmailWithCode(sendEmailInput);
  }
}
